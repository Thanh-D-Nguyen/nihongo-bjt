import {
  adminAchievementDefinitionSchema,
  adminAchievementTierSchema,
  adminLeaderboardConfigSchema,
  adminStreakConfigSchema
} from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags
} from "@nestjs/swagger";
import type { Request } from "express";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { GamificationRepository } from "./gamification.repository.js";

@Controller("admin/gamification")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("admin_core")
@LogAdminAction({ resourceType: "admin.gamification" })
@ApiTags("Admin Gamification")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class GamificationAdminController {
  constructor(
    @Inject(GamificationRepository) private readonly repo: GamificationRepository,
    @Inject(AdminAuthService) private readonly adminAuth: AdminAuthService
  ) {}

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Streak Config ──────────────────────────────────────────────────── */

  @Get("streaks")
  @ApiOperation({ summary: "List all streak configurations." })
  async listStreakConfigs(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, [
      "content.manage",
      "viewer.audit"
    ]);
    return this.repo.listStreakConfigs();
  }

  @Post("streaks")
  @ApiOperation({ summary: "Create a new streak configuration." })
  async createStreakConfig(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "content.manage");
    const parsed = adminStreakConfigSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    return this.repo.createStreakConfig({
      ...parsed.data,
      actorId: principal.actorId
    });
  }

  @Put("streaks/:id")
  @ApiOperation({ summary: "Update a streak configuration." })
  @ApiParam({ name: "id", description: "Streak config ID" })
  async updateStreakConfig(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const principal = await this.adminAuth.requirePermission(req, "content.manage");
    const parsed = adminStreakConfigSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    return this.repo.updateStreakConfig(id, {
      ...parsed.data,
      actorId: principal.actorId
    });
  }

  @Delete("streaks/:id")
  @ApiOperation({ summary: "Delete a streak configuration." })
  @ApiParam({ name: "id", description: "Streak config ID" })
  async deleteStreakConfig(@Req() req: Request, @Param("id") id: string) {
    await this.adminAuth.requirePermission(req, "content.manage");
    return this.repo.deleteStreakConfig(id);
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Achievement Definition ─────────────────────────────────────────── */

  @Get("achievements")
  @ApiOperation({ summary: "List all achievement definitions with tiers." })
  async listAchievements(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, [
      "content.manage",
      "viewer.audit"
    ]);
    return this.repo.listAchievementDefinitions();
  }

  @Get("achievements/:id")
  @ApiOperation({ summary: "Get a single achievement definition with tiers." })
  @ApiParam({ name: "id", description: "Achievement definition ID" })
  async getAchievement(@Req() req: Request, @Param("id") id: string) {
    await this.adminAuth.requireOneOfPermissions(req, [
      "content.manage",
      "viewer.audit"
    ]);
    return this.repo.findAchievementDefinition(id);
  }

  @Post("achievements")
  @ApiOperation({ summary: "Create a new achievement definition." })
  async createAchievement(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "content.manage");
    const parsed = adminAchievementDefinitionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    return this.repo.createAchievementDefinition({
      ...parsed.data,
      iconUrl: parsed.data.iconUrl ?? null,
      actorId: principal.actorId
    });
  }

  @Put("achievements/:id")
  @ApiOperation({ summary: "Update an achievement definition." })
  @ApiParam({ name: "id", description: "Achievement definition ID" })
  async updateAchievement(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const principal = await this.adminAuth.requirePermission(req, "content.manage");
    const parsed = adminAchievementDefinitionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    return this.repo.updateAchievementDefinition(id, {
      ...parsed.data,
      iconUrl: parsed.data.iconUrl ?? null,
      actorId: principal.actorId
    });
  }

  @Delete("achievements/:id")
  @ApiOperation({ summary: "Delete an achievement definition and its tiers." })
  @ApiParam({ name: "id", description: "Achievement definition ID" })
  async deleteAchievement(@Req() req: Request, @Param("id") id: string) {
    await this.adminAuth.requirePermission(req, "content.manage");
    return this.repo.deleteAchievementDefinition(id);
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Achievement Tiers ──────────────────────────────────────────────── */

  @Get("achievements/:achievementId/tiers")
  @ApiOperation({ summary: "List tiers for an achievement." })
  @ApiParam({ name: "achievementId", description: "Achievement definition ID" })
  async listTiers(
    @Req() req: Request,
    @Param("achievementId") achievementId: string
  ) {
    await this.adminAuth.requireOneOfPermissions(req, [
      "content.manage",
      "viewer.audit"
    ]);
    return this.repo.tiersForAchievement(achievementId);
  }

  @Post("achievements/:achievementId/tiers")
  @ApiOperation({ summary: "Add a tier to an achievement." })
  @ApiParam({ name: "achievementId", description: "Achievement definition ID" })
  async createTier(
    @Req() req: Request,
    @Param("achievementId") achievementId: string,
    @Body() body: unknown
  ) {
    await this.adminAuth.requirePermission(req, "content.manage");
    const parsed = adminAchievementTierSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    return this.repo.createAchievementTier(achievementId, {
      ...parsed.data,
      rewardType: parsed.data.rewardType ?? null,
      rewardValue: parsed.data.rewardValue ?? null,
      iconUrl: parsed.data.iconUrl ?? null,
      nameKey: parsed.data.nameKey ?? null
    });
  }

  @Put("achievements/tiers/:id")
  @ApiOperation({ summary: "Update an achievement tier." })
  @ApiParam({ name: "id", description: "Achievement tier ID" })
  async updateTier(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    await this.adminAuth.requirePermission(req, "content.manage");
    const parsed = adminAchievementTierSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    return this.repo.updateAchievementTier(id, {
      ...parsed.data,
      rewardType: parsed.data.rewardType ?? null,
      rewardValue: parsed.data.rewardValue ?? null,
      iconUrl: parsed.data.iconUrl ?? null,
      nameKey: parsed.data.nameKey ?? null
    });
  }

  @Delete("achievements/tiers/:id")
  @ApiOperation({ summary: "Delete an achievement tier." })
  @ApiParam({ name: "id", description: "Achievement tier ID" })
  async deleteTier(@Req() req: Request, @Param("id") id: string) {
    await this.adminAuth.requirePermission(req, "content.manage");
    return this.repo.deleteAchievementTier(id);
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Leaderboard Config ─────────────────────────────────────────────── */

  @Get("leaderboards")
  @ApiOperation({ summary: "List all leaderboard configurations." })
  async listLeaderboards(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, [
      "content.manage",
      "viewer.audit"
    ]);
    return this.repo.listLeaderboardConfigs();
  }

  @Post("leaderboards")
  @ApiOperation({ summary: "Create a new leaderboard configuration." })
  async createLeaderboard(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "content.manage");
    const parsed = adminLeaderboardConfigSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    return this.repo.createLeaderboardConfig({
      ...parsed.data,
      nameKey: parsed.data.nameKey ?? null,
      actorId: principal.actorId
    });
  }

  @Put("leaderboards/:id")
  @ApiOperation({ summary: "Update a leaderboard configuration." })
  @ApiParam({ name: "id", description: "Leaderboard config ID" })
  async updateLeaderboard(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const principal = await this.adminAuth.requirePermission(req, "content.manage");
    const parsed = adminLeaderboardConfigSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    return this.repo.updateLeaderboardConfig(id, {
      ...parsed.data,
      nameKey: parsed.data.nameKey ?? null,
      actorId: principal.actorId
    });
  }

  @Delete("leaderboards/:id")
  @ApiOperation({ summary: "Delete a leaderboard configuration." })
  @ApiParam({ name: "id", description: "Leaderboard config ID" })
  async deleteLeaderboard(@Req() req: Request, @Param("id") id: string) {
    await this.adminAuth.requirePermission(req, "content.manage");
    return this.repo.deleteLeaderboardConfig(id);
  }
}
