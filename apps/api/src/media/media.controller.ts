import {
  completeMediaUploadSchema,
  mediaReadUrlQuerySchema,
  presignMediaUploadSchema,
  updateMediaRightsMetadataSchema
} from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  ParseUUIDPipe,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiTags
} from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import {
  MediaAssetRightsMetadataOpenApiDto,
  MediaRightsMetadataUpdateRequestOpenApiDto
} from "../openapi/dto/backend-api-openapi.dto.js";
import { RuntimeFeatureGateService } from "../operations/runtime-feature-gate.service.js";
import { MediaService } from "./media.service.js";

const mediaMimeToExtensions: Record<string, string[]> = {
  "image/gif": ["gif"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"]
};

function assertUploadFileNameMatchesMimeType(fileName: string, mimeType: string) {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0 || dot === fileName.length - 1) {
    throw new BadRequestException("fileName must include an extension");
  }

  const ext = fileName.slice(dot + 1).toLowerCase();
  const allowedExtensions = mediaMimeToExtensions[mimeType] ?? [];
  if (!allowedExtensions.includes(ext)) {
    throw new BadRequestException("fileName extension does not match mimeType");
  }
}

@Controller("media")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Media")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class MediaController {
  constructor(
    @Inject(MediaService) private readonly mediaService: MediaService,
    @Inject(RuntimeFeatureGateService) private readonly featureGate: RuntimeFeatureGateService
  ) {}

  @Post("presign-upload")
  @ApiOperation({
    summary: "Create `media_asset` + presigned PUT URL; `rightsStatus` starts **pending_review** (provenance in DB).",
    description: "No MinIO secret in response — time-limited upload URL only."
  })
  async presign(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Body() body: unknown) {
    await this.featureGate.requireEnabled("external_media_uploads", {
      message: "Media uploads are temporarily disabled"
    });
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = presignMediaUploadSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    assertUploadFileNameMatchesMimeType(parsed.data.fileName, parsed.data.mimeType);

    return this.mediaService.presignUpload(parsed.data);
  }

  @Post("complete-upload")
  @ApiOperation({ summary: "Verify object exists in storage and set byte size on asset." })
  async completeUpload(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Body() body: unknown) {
    await this.featureGate.requireEnabled("external_media_uploads", {
      message: "Media uploads are temporarily disabled"
    });
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = completeMediaUploadSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.mediaService.completeUpload(parsed.data);
  }

  @Post("assets/:assetId/rights-metadata")
  @ApiOperation({
    summary: "Store provenance/license metadata and clear asset rights warnings once integrity checks pass."
  })
  @ApiParam({ name: "assetId", schema: { type: "string", format: "uuid" } })
  @ApiBody({ type: MediaRightsMetadataUpdateRequestOpenApiDto })
  @ApiCreatedResponse({ type: MediaAssetRightsMetadataOpenApiDto })
  async updateRightsMetadata(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("assetId", new ParseUUIDPipe()) assetId: string,
    @Body() body: unknown
  ) {
    await this.featureGate.requireEnabled("external_media_uploads", {
      message: "Media uploads are temporarily disabled"
    });
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = updateMediaRightsMetadataSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.mediaService.updateRightsMetadata({ assetId, ...parsed.data });
  }

  @Get("assets/:assetId/read-url")
  @ApiOperation({ summary: "Short-lived **GET** URL for the learner’s own asset (access check server-side)." })
  @ApiParam({ name: "assetId" })
  async readUrl(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("assetId") assetId: string,
    @Query() query: Record<string, string | undefined>
  ) {
    await this.featureGate.requireEnabled("external_media_uploads", {
      message: "Media uploads are temporarily disabled"
    });
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = mediaReadUrlQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.mediaService
      .getReadUrlForAsset({ assetId, userId: parsed.data.userId })
      .then((readUrl) => ({ expiresInSeconds: 3600, readUrl }));
  }
}
