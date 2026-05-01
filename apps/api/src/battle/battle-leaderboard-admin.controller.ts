import { adminBattleLeaderboardQuerySchema } from "@nihongo-bjt/shared";
import { BadRequestException, Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiSecurity,
  ApiTags
} from "@nestjs/swagger";
import type { Request } from "express";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";

import { BattleLeaderboardAdminRepository } from "./battle-leaderboard-admin.repository.js";

/**
 * Admin Battle Leaderboard — window-based ranking (all / 30d / 90d) from `battle_session`.
 *
 * Read-only in this slice; season management (`BattleSeason`, `reset-season`, `create-season`) is
 * tracked as `partial_schema_pending`. RBAC: `battle.manage` or `viewer.audit`.
 */
@Controller("admin/battle/leaderboard")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("battle")
@LogAdminAction({ resourceType: "admin.battle.leaderboard" })
@ApiTags("Admin Battle", "Battle Leaderboard")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class BattleLeaderboardAdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly repo: BattleLeaderboardAdminRepository
  ) {}

  @Get()
  @ApiOperation({
    summary: "Window-based battle leaderboard (all / 30d / 90d). Pagination 25/page.",
    description: "**RBAC:** `battle.manage` or `viewer.audit`. Returns rankings + summary."
  })
  @ApiQuery({ name: "window", required: false, enum: ["all", "30d", "90d"] })
  @ApiQuery({ name: "page", required: false, schema: { type: "integer", default: 1 } })
  @ApiQuery({ name: "pageSize", required: false, schema: { type: "integer", default: 25 } })
  @ApiOkResponse({ description: "Paginated leaderboard with summary." })
  async list(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ["battle.manage", "viewer.audit"]);
    const parsed = adminBattleLeaderboardQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.repo.list(parsed.data);
  }
}
