import {
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags
} from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { GamificationService } from "./gamification.service.js";

@Controller("gamification")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Gamification")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class GamificationController {
  constructor(
    @Inject(GamificationService) private readonly svc: GamificationService
  ) {}

  /* ── Streaks ─────────────────────────────────────────────────────────── */

  @Get("streaks")
  @ApiOperation({ summary: "Get all streak data for the current user." })
  async getStreaks(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("userId") userId: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    return this.svc.getUserStreaks(resolved);
  }

  @Post("streaks/record")
  @ApiOperation({
    summary: "Record an activity for streak tracking.",
    description: "Records the user performed an activity (review, exercise, quiz, battle). Updates all matching streak configs."
  })
  @ApiQuery({ name: "activityType", required: true, schema: { type: "string", enum: ["review", "exercise", "quiz", "battle"] } })
  async recordActivity(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("userId") userId: string | undefined,
    @Query("activityType") activityType: string
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    await this.svc.recordActivity(resolved, activityType);
    return { success: true };
  }

  /* ── Achievements ────────────────────────────────────────────────────── */

  @Get("achievements")
  @ApiOperation({ summary: "Get all achievement definitions with tiers." })
  async getAchievementDefinitions() {
    return this.svc.getAllAchievementDefinitions();
  }

  @Get("achievements/me")
  @ApiOperation({ summary: "Get the current user's achievement progress and earned tiers." })
  async getMyAchievements(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("userId") userId: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    return this.svc.getUserAchievements(resolved);
  }

  @Get("achievements/me/earned")
  @ApiOperation({ summary: "Get only the user's earned achievements (for profile/share)." })
  async getMyEarnedAchievements(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("userId") userId: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    return this.svc.getUserEarnedAchievements(resolved);
  }

  /* ── Leaderboards ────────────────────────────────────────────────────── */

  @Get("leaderboards")
  @ApiOperation({ summary: "List all enabled leaderboards." })
  async listLeaderboards() {
    return this.svc.getEnabledLeaderboards();
  }

  @Get("leaderboards/:id")
  @ApiOperation({ summary: "Get leaderboard entries (ranked list) for a specific board." })
  @ApiParam({ name: "id", description: "Leaderboard config ID" })
  async getLeaderboard(@Param("id") id: string) {
    return this.svc.getLeaderboard(id);
  }

  @Get("leaderboards/:id/me")
  @ApiOperation({ summary: "Get the current user's rank on a specific leaderboard." })
  @ApiParam({ name: "id", description: "Leaderboard config ID" })
  async getMyRank(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") leaderboardId: string,
    @Query("userId") userId: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    return this.svc.getUserRank(leaderboardId, resolved);
  }
}
