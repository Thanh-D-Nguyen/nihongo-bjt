import {
  battleChatRecentQuerySchema,
  battleLearnerLeaderboardQuerySchema,
  battleRecentQuerySchema
} from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

import { z } from "zod";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { BattleLeaderboardLearnerRepository } from "./battle-leaderboard-learner.repository.js";
import { BattleRepository } from "./battle.repository.js";

@Controller("battle")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Battle")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class BattleController {
  constructor(
    @Inject(BattleRepository) private readonly battleRepository: BattleRepository,
    @Inject(BattleLeaderboardLearnerRepository)
    private readonly battleLeaderboardLearnerRepository: BattleLeaderboardLearnerRepository
  ) {}

  @Get("leaderboard")
  @ApiOperation({
    summary: "Public-style battle leaderboard for learners",
    description:
      "Rankings from completed battles (bot + PvP, both sides). Returns display names only; highlights the authenticated learner. Query: window (30d default), page, pageSize."
  })
  @ApiQuery({ name: "window", required: false, enum: ["all", "30d", "90d"] })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  learnerLeaderboard(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const parsed = battleLearnerLeaderboardQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const viewerUserId = user?.appUserId ?? null;
    return this.battleLeaderboardLearnerRepository.list({
      ...parsed.data,
      viewerUserId
    });
  }

  @Get("player-stats")
  @ApiOperation({
    summary: "Compact battle stats for a learner (lobby popover)",
    description:
      "Authenticated learners only. Aggregate wins/losses from completed bot + PvP sessions — same basis as the public leaderboard, for any `userId`."
  })
  @ApiQuery({ name: "userId", required: true, description: "Target `user_profile.id`" })
  playerStatsCompact(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("userId") userIdRaw: string | undefined
  ) {
    if (!user?.appUserId) {
      throw new UnauthorizedException();
    }
    const parsed = z.string().uuid().safeParse(userIdRaw);
    if (!parsed.success) {
      throw new BadRequestException("userId must be a UUID");
    }
    return this.battleRepository.battleStatsCompactPublic(parsed.data);
  }

  @Get("stats")
  @ApiOperation({
    summary: "Learner battle record (wins/losses, PvP vs bot split, milestones)",
    description: "Uses `battle_session` with correct perspective for PvP when the learner was the challenger or opponent."
  })
  @ApiQuery({ name: "userId", required: true, description: "App user id" })
  learnerStats(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    return this.battleRepository.learnerBattleStats(userId);
  }

  @Get("bots")
  @ApiOperation({
    summary: "List active playable battle bots",
    description: "Returns admin-managed active bots from PostgreSQL, or registry fallback bots when no active managed bots exist."
  })
  bots() {
    return this.battleRepository.listPlayableBots();
  }

  @Get("chat/recent")
  @ApiOperation({
    summary: "List recent battle lobby chat messages",
    description: "Keycloak-issued **Bearer** JWT. Returns visible messages for the requested battle room."
  })
  @ApiQuery({ name: "roomKey", required: false, description: "Battle room key, default `global`" })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "1–80, default 40" })
  chatRecent(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = battleChatRecentQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.battleRepository.listRecentChatMessages({
      limit: parsed.data.limit,
      roomKey: parsed.data.roomKey
    });
  }

  @Get("sessions/recent")
  @ApiOperation({
    summary: "List recent battle sessions for user",
    description: "Keycloak-issued **Bearer** JWT. Query: `battleRecentQuerySchema` (`userId`, `limit`)."
  })
  @ApiQuery({ name: "userId", required: true, description: "App user id" })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "1–20, default 10" })
  recent(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = battleRecentQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.battleRepository.listRecentForUser(parsed.data.userId, parsed.data.limit);
  }

  @Get("configs/available")
  @ApiOperation({
    summary: "List published battle configs available for learners",
    description:
      "Returns battle configs with status=published that are currently active (within schedule window or no schedule)."
  })
  availableConfigs() {
    return this.battleRepository.listPublishedConfigs();
  }
}
