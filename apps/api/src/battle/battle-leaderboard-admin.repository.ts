import { Injectable } from "@nestjs/common";
import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import type { z } from "zod";

import type { adminBattleLeaderboardQuerySchema } from "@nihongo-bjt/shared";

type ListInput = z.infer<typeof adminBattleLeaderboardQuerySchema>;

type RankingRow = {
  userId: string;
  wins: bigint;
  losses: bigint;
  totalMatches: bigint;
  avgScore: number;
};

@Injectable()
export class BattleLeaderboardAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  /**
   * Window-based leaderboard from `battle_session` (no `BattleSeason` model yet — season
   * management tracked as `partial_schema_pending`). Returns paginated rankings + total count
   * + a small `summary` (totalParticipants, completedMatches in window, since-date).
   */
  async list(input: ListInput) {
    const since = this.windowToDate(input.window);
    const sinceClause = since ? `AND started_at >= TIMESTAMP WITH TIME ZONE '${since.toISOString()}'` : "";
    const offset = (input.page - 1) * input.pageSize;

    const [rankings, totalRow, summaryRow] = await Promise.all([
      this.prisma.$queryRawUnsafe<RankingRow[]>(`
        SELECT
          user_id AS "userId",
          COUNT(*) FILTER (WHERE user_score > opponent_score) AS wins,
          COUNT(*) FILTER (WHERE user_score < opponent_score) AS losses,
          COUNT(*) AS "totalMatches",
          ROUND(AVG(user_score)::numeric, 1)::float AS "avgScore"
        FROM learning.battle_session
        WHERE status = 'completed' ${sinceClause}
        GROUP BY user_id
        HAVING COUNT(*) >= 1
        ORDER BY COUNT(*) FILTER (WHERE user_score > opponent_score) DESC, AVG(user_score) DESC
        LIMIT ${input.pageSize} OFFSET ${offset}
      `),
      this.prisma.$queryRawUnsafe<Array<{ total: bigint }>>(`
        SELECT COUNT(*)::bigint AS total
        FROM (
          SELECT user_id FROM learning.battle_session
          WHERE status = 'completed' ${sinceClause}
          GROUP BY user_id HAVING COUNT(*) >= 1
        ) sub
      `),
      this.prisma.$queryRawUnsafe<Array<{ participants: bigint; completedMatches: bigint }>>(`
        SELECT
          COUNT(DISTINCT user_id)::bigint AS participants,
          COUNT(*)::bigint AS "completedMatches"
        FROM learning.battle_session
        WHERE status = 'completed' ${sinceClause}
      `)
    ]);

    const total = Number(totalRow[0]?.total ?? 0n);
    const summary = summaryRow[0];
    return {
      items: rankings.map((r, idx) => ({
        avgScore: Number(r.avgScore ?? 0),
        losses: Number(r.losses),
        rank: offset + idx + 1,
        totalMatches: Number(r.totalMatches),
        userId: r.userId,
        winRate:
          Number(r.totalMatches) > 0
            ? Number(((Number(r.wins) / Number(r.totalMatches)) * 100).toFixed(1))
            : 0,
        wins: Number(r.wins)
      })),
      page: input.page,
      pageSize: input.pageSize,
      summary: {
        completedMatches: Number(summary?.completedMatches ?? 0n),
        since: since?.toISOString() ?? null,
        totalParticipants: Number(summary?.participants ?? 0n),
        window: input.window
      },
      total
    };
  }

  private windowToDate(window: ListInput["window"]): Date | null {
    if (window === "all") return null;
    const now = new Date();
    if (window === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (window === "90d") return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    return null;
  }
}
