import {
  completeMediaUploadSchema,
  mediaReadUrlQuerySchema,
  presignMediaUploadSchema,
  searchImagesSchema,
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
import { ImageSearchService } from "./image-search.service.js";
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
    @Inject(RuntimeFeatureGateService) private readonly featureGate: RuntimeFeatureGateService,
    @Inject(ImageSearchService) private readonly imageSearch: ImageSearchService
  ) {}

  @Post("search-images")
  @ApiOperation({ summary: "Search images from external providers (Unsplash, Pixabay, Google). Daily quota enforced." })
  async searchImages(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Body() body: unknown) {
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = searchImagesSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const images = await this.imageSearch.search(userId, parsed.data.query, parsed.data.limit);
    return { images };
  }

  @Post("proxy-image")
  @ApiOperation({ summary: "Download an external image URL, store in MinIO, return assetId." })
  @ApiCreatedResponse({ description: "Proxied image asset ID." })
  async proxyImage(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Body() body: unknown) {
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const url = typeof raw.url === "string" ? raw.url.trim() : "";
    if (!url || url.length > 2048) {
      throw new BadRequestException("url is required and must be <= 2048 chars");
    }
    try {
      new URL(url);
    } catch {
      throw new BadRequestException("url must be a valid URL");
    }
    const altText = typeof raw.altText === "string" ? raw.altText.slice(0, 200) : "";
    const source = typeof raw.source === "string" ? raw.source.slice(0, 50) : "user_selected";

    const assetId = await this.mediaService.proxyDownloadExternalImage({
      url,
      userId,
      altText,
      license: "user_supplied_link",
      provenance: { kind: "learner_image_proxy", originalUrl: url, source },
    });

    if (!assetId) {
      throw new BadRequestException("Failed to download image. The URL may be inaccessible or not a valid image.");
    }

    return { assetId };
  }

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
