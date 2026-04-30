import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { createPrismaClient } from "@nihongo-bjt/database";
import { BATTLE_BOT_PROFILES, DEFAULT_BATTLE_BOT_KEY } from "@nihongo-bjt/shared";
import { z } from "zod";

import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  status: z.string().trim().min(1).max(32).optional()
});

const DEFAULT_MAX_ROUNDS = 5;

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

  @Get("sessions")
  @ApiOperation({ summary: "List battle sessions (matches) with pagination." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiQuery({ name: "status", required: false, schema: { type: "string" } })
  @ApiOkResponse({ description: "Paginated list of battle sessions." })
  async listSessions(@Query() query: Record<string, unknown>) {
    const parsed = listQuerySchema.parse(query);
    const where: Record<string, unknown> = {};
    if (parsed.status) where.status = parsed.status;

    const [items, total] = await Promise.all([
      this.prisma.battleSession.findMany({
        include: { _count: { select: { rounds: true } } },
        orderBy: { startedAt: "desc" },
        skip: parsed.offset,
        take: parsed.limit,
        where
      }),
      this.prisma.battleSession.count({ where })
    ]);
    return { items, total };
  }

  @Get("configs")
  @ApiOperation({ summary: "List current battle configuration (code-defined)." })
  @ApiOkResponse({ description: "Battle configuration parameters." })
  async listConfigs() {
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

  @Get("bots")
  @ApiOperation({ summary: "List battle bot profiles (code-defined)." })
  @ApiOkResponse({ description: "Bot profiles with difficulty parameters." })
  async listBots() {
    // Aggregate win/loss stats per bot from real session data
    const botStats = await this.prisma.battleSession.groupBy({
      by: ["botKey"],
      _count: { id: true },
      _avg: { userScore: true, opponentScore: true },
      where: { status: "completed", botKey: { not: null } }
    });
    const statsMap = new Map(botStats.map((s) => [s.botKey, s]));

    const items = Object.entries(BATTLE_BOT_PROFILES).map(([key, profile]) => {
      const stats = statsMap.get(key);
      return {
        botKey: key,
        labelI18nKey: profile.labelI18nKey,
        correctProbability: profile.correctProbability,
        minDelayMs: profile.minDelayMs,
        maxDelayMs: profile.maxDelayMs,
        isDefault: key === DEFAULT_BATTLE_BOT_KEY,
        totalMatches: stats?._count?.id ?? 0,
        avgUserScore: stats?._avg?.userScore ? Number(stats._avg.userScore.toFixed(1)) : 0,
        avgBotScore: stats?._avg?.opponentScore ? Number(stats._avg.opponentScore.toFixed(1)) : 0
      };
    });
    return { items };
  }

  @Get("leaderboard")
  @ApiOperation({ summary: "Battle leaderboard — top players by win count." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiOkResponse({ description: "Leaderboard rankings." })
  async leaderboard(@Query() query: Record<string, unknown>) {
    const limit = z.coerce.number().int().min(1).max(100).optional().default(50).parse(query.limit);

    const rankings = await this.prisma.$queryRaw<Array<{
      userId: string;
      wins: bigint;
      losses: bigint;
      totalMatches: bigint;
      avgScore: number;
    }>>`
      SELECT
        user_id AS "userId",
        COUNT(*) FILTER (WHERE user_score > opponent_score) AS wins,
        COUNT(*) FILTER (WHERE user_score < opponent_score) AS losses,
        COUNT(*) AS "totalMatches",
        ROUND(AVG(user_score)::numeric, 1) AS "avgScore"
      FROM learning.battle_session
      WHERE status = 'completed'
      GROUP BY user_id
      HAVING COUNT(*) >= 1
      ORDER BY COUNT(*) FILTER (WHERE user_score > opponent_score) DESC, AVG(user_score) DESC
      LIMIT ${limit}
    `;

    return {
      items: rankings.map((r, idx) => ({
        rank: idx + 1,
        userId: r.userId,
        wins: Number(r.wins),
        losses: Number(r.losses),
        totalMatches: Number(r.totalMatches),
        avgScore: Number(r.avgScore),
        winRate: Number(r.totalMatches) > 0
          ? Number((Number(r.wins) / Number(r.totalMatches) * 100).toFixed(1))
          : 0
      }))
    };
  }

  @Get("abuse-signals")
  @ApiOperation({ summary: "Battle abuse signals — suspicious patterns." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiOkResponse({ description: "Suspicious battle patterns." })
  async abuseSignals(@Query() query: Record<string, unknown>) {
    const limit = z.coerce.number().int().min(1).max(100).optional().default(50).parse(query.limit);

    // Flag users with high abandon rates or suspiciously fast completions
    const signals = await this.prisma.$queryRaw<Array<{
      userId: string;
      totalMatches: bigint;
      abandoned: bigint;
      avgDurationSeconds: number;
      signalType: string;
    }>>`
      SELECT
        user_id AS "userId",
        COUNT(*) AS "totalMatches",
        COUNT(*) FILTER (WHERE status = 'abandoned') AS abandoned,
        ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))::numeric, 0) AS "avgDurationSeconds",
        CASE
          WHEN COUNT(*) FILTER (WHERE status = 'abandoned') > COUNT(*) * 0.5 THEN 'high_abandon_rate'
          WHEN AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) < 5 AND COUNT(*) FILTER (WHERE status = 'completed') > 3 THEN 'suspiciously_fast'
          ELSE 'review'
        END AS "signalType"
      FROM learning.battle_session
      GROUP BY user_id
      HAVING COUNT(*) FILTER (WHERE status = 'abandoned') > COUNT(*) * 0.3
        OR (AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) < 10 AND COUNT(*) FILTER (WHERE status = 'completed') > 3)
      ORDER BY COUNT(*) FILTER (WHERE status = 'abandoned') DESC
      LIMIT ${limit}
    `;

    return {
      items: signals.map((s) => ({
        userId: s.userId,
        totalMatches: Number(s.totalMatches),
        abandoned: Number(s.abandoned),
        avgDurationSeconds: s.avgDurationSeconds ? Number(s.avgDurationSeconds) : null,
        signalType: s.signalType
      }))
    };
  }
}
