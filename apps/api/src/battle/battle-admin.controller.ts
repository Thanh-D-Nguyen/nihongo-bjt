import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { createPrismaClient } from "@nihongo-bjt/database";
import { DEFAULT_BATTLE_BOT_KEY } from "@nihongo-bjt/shared";

import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";

const DEFAULT_MAX_ROUNDS = 5;

/**
 * Legacy battle admin controller — code-defined system parameters only.
 *
 * Per-domain admin workflows (matches/leaderboard/bots/abuse) live in dedicated controllers
 * (`BattleMatchesAdminController`, `BattleLeaderboardAdminController`, `BattleBotsAdminController`,
 * `BattleAbuseAdminController`) under `/admin/battle/{matches,leaderboard,bots,abuse}`. Battle Configs
 * CRUD lives in `BattleConfigsAdminController`. This controller now only exposes immutable runtime
 * tuning parameters defined in code/env that ops want to inspect.
 */
@Controller("admin/battle")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("admin_core")
@LogAdminAction({ resourceType: "admin.battle" })
@ApiTags("Admin Battle")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class BattleAdminController {
  private readonly prisma = createPrismaClient();

  @Get("system-parameters")
  @ApiOperation({ summary: "List code-defined battle system parameters and live runtime stats." })
  @ApiOkResponse({ description: "Battle system parameters (read-only, from code/env + DB stats)." })
  async listSystemParameters() {
    const totalSessions = await this.prisma.battleSession.count();
    const activeSessions = await this.prisma.battleSession.count({ where: { status: "in_progress" } });

    return {
      items: [
        { key: "defaultMaxRounds", value: String(DEFAULT_MAX_ROUNDS), source: "code", description: "Default max rounds per battle" },
        { key: "defaultBotKey", value: DEFAULT_BATTLE_BOT_KEY, source: "code", description: "Default bot profile key" },
        { key: "availableModes", value: "bot", source: "code", description: "Available battle modes" },
        { key: "roomCodeLength", value: "16", source: "code", description: "Room code max length" },
        { key: "totalSessions", value: String(totalSessions), source: "db", description: "Total battle sessions in DB" },
        { key: "activeSessions", value: String(activeSessions), source: "db", description: "Currently in-progress sessions" }
      ]
    };
  }
}
