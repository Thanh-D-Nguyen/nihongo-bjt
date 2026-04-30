import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { PrivacyRequestService } from "./privacy-request.service.js";

const createRequestSchema = z.object({
  kind: z.enum(["export", "delete"])
});

/**
 * Privacy request controller.
 *
 * Security contract:
 * - All routes require authentication.
 * - Users can only access their own requests (enforced in PrivacyRequestService).
 * - Stop condition: any bypass of userId check is a hard security violation.
 */
@Controller("privacy/requests")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Privacy")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class PrivacyRequestController {
  constructor(private readonly privacyService: PrivacyRequestService) {}

  @Post()
  @ApiOperation({
    summary: "Submit a privacy export or account deletion request",
    description:
      "Submit a data export (kind=export) or account deletion (kind=delete) request. " +
      "Only one pending request per kind is allowed. Processing is asynchronous."
  })
  create(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const parsed = createRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.privacyService.create(userId, parsed.data.kind);
  }

  @Get()
  @ApiOperation({ summary: "List own privacy requests" })
  listOwn(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    if (!user) {
      throw new UnauthorizedException();
    }
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.privacyService.listOwn(userId);
  }

  @Get(":id")
  @ApiParam({ name: "id", description: "Privacy request UUID" })
  @ApiOperation({ summary: "Get a specific privacy request (own data only)" })
  getOwn(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id", ParseUUIDPipe) id: string
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.privacyService.getOwn(userId, id);
  }

  @Get(":id/download")
  @ApiParam({ name: "id", description: "Privacy request UUID" })
  @ApiOperation({
    summary: "Get export download URL for a completed export request (own data only)",
    description:
      "Returns download URL for completed data export. Only accessible by the request owner. " +
      "URL is pre-signed and time-limited (TODO: implement in production processor)."
  })
  getDownload(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id", ParseUUIDPipe) id: string
  ) {
    if (!user) {
      throw new UnauthorizedException();
    }
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.privacyService.getDownloadUrl(userId, id);
  }
}
