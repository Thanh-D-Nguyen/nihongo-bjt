import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { KeycloakAuthOptional } from "../keycloak/keycloak-public.decorator.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { PresenceService } from "../presence/presence.service.js";
import { PublicProfileRepository } from "./public-profile.repository.js";

@Controller("users")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Public Profiles")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class PublicProfileController {
  constructor(
    @Inject(PublicProfileRepository) private readonly profileRepo: PublicProfileRepository,
    @Inject(PresenceService) private readonly presence: PresenceService
  ) {}

  @Get(":userId/profile")
  @KeycloakAuthOptional()
  @ApiOperation({
    summary: "Get public profile of a user",
    description:
      "Returns a user's public profile with privacy-filtered data. " +
      "Unauthenticated viewers see minimal info based on privacy level. " +
      "Authenticated viewers see more based on their relationship (self/friend/stranger)."
  })
  @ApiParam({ name: "userId", type: "string", format: "uuid" })
  async getPublicProfile(
    @Param("userId") userIdRaw: string,
    @CurrentUser() viewer: KeycloakAuthenticatedUser | undefined
  ) {
    const parsed = z.string().uuid().safeParse(userIdRaw);
    if (!parsed.success) {
      throw new BadRequestException("userId must be a valid UUID");
    }

    const targetUserId = parsed.data;
    const viewerUserId = viewer?.appUserId ?? null;

    const profile = await this.profileRepo.assemblePublicProfile(targetUserId, viewerUserId);
    if (!profile) {
      throw new NotFoundException("User not found");
    }

    // Inject online presence
    const presenceData = await this.presence.getPresenceBatch([targetUserId]);
    const userPresence = presenceData[targetUserId];

    return {
      ...profile,
      online: userPresence?.online ?? false,
      lastSeenAt: userPresence?.lastSeenAt ?? null,
    };
  }

  @Get(":userId/presence")
  @KeycloakAuthOptional()
  @ApiOperation({
    summary: "Check if a user is online",
    description: "Returns online status and last seen timestamp for a user."
  })
  @ApiParam({ name: "userId", type: "string", format: "uuid" })
  async getUserPresence(@Param("userId") userIdRaw: string) {
    const parsed = z.string().uuid().safeParse(userIdRaw);
    if (!parsed.success) {
      throw new BadRequestException("userId must be a valid UUID");
    }

    const result = await this.presence.getPresenceBatch([parsed.data]);
    return result[parsed.data] ?? { online: false, lastSeenAt: null };
  }

  @Get("presence/batch")
  @ApiOperation({
    summary: "Check online status for multiple users",
    description: "Returns online status for up to 50 users. Requires authentication."
  })
  @ApiQuery({ name: "ids", required: true, description: "Comma-separated user UUIDs (max 50)" })
  async getPresenceBatch(
    @CurrentUser() viewer: KeycloakAuthenticatedUser | undefined,
    @Query("ids") idsRaw: string | undefined
  ) {
    if (!viewer?.appUserId) {
      return {};
    }

    const ids = (idsRaw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => z.string().uuid().safeParse(s).success);

    if (ids.length === 0 || ids.length > 50) {
      throw new BadRequestException("Provide 1-50 valid UUIDs separated by commas");
    }

    return this.presence.getPresenceBatch(ids);
  }
}
