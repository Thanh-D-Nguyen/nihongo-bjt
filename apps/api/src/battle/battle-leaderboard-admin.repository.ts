import { Injectable } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
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
    const sinceFragment = since
      ? Prisma.sql`AND started_at >= ${since}`
      : Prisma.empty;
    const limit = input.pageSize;
    const offset = (input.page - 1) * input.pageSize;

    const [rankings, totalRow, summaryRow] = await Promise.all([
      this.prisma.$queryRaw<RankingRow[]>`
        WITH participant_sessions AS (
          SELECT user_id AS pid, user_score AS my_score, opponent_score AS their_score
          FROM learning.battle_session
          WHERE status = 'completed' AND mode = 'bot' ${sinceFragment}
          UNION ALL
          SELECT user_id, user_score, opponent_score
          FROM learning.battle_session
          WHERE status = 'completed' AND mode = 'pvp' ${sinceFragment}
          UNION ALL
          SELECT opponent_user_id, opponent_score, user_score
          FROM learning.battle_session
          WHERE status = 'completed' AND mode = 'pvp' AND opponent_user_id IS NOT NULL ${sinceFragment}
        )
        SELECT
          pid AS "userId",
          COUNT(*) FILTER (WHERE my_score > their_score) AS wins,
          COUNT(*) FILTER (WHERE my_score < their_score) AS losses,
          COUNT(*)::bigint AS "totalMatches",
          ROUND(AVG(my_score)::numeric, 1)::float AS "avgScore"
        FROM participant_sessions
        WHERE pid IS NOT NULL
        GROUP BY pid
        HAVING COUNT(*) >= 1
        ORDER BY COUNT(*) FILTER (WHERE my_score > their_score) DESC, AVG(my_score) DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<Array<{ total: bigint }>>`
        WITH participant_sessions AS (
          SELECT user_id AS pid
          FROM learning.battle_session
          WHERE status = 'completed' AND mode = 'bot' ${sinceFragment}
          UNION ALL
          SELECT user_id FROM learning.battle_session
          WHERE status = 'completed' AND mode = 'pvp' ${sinceFragment}
          UNION ALL
          SELECT opponent_user_id FROM learning.battle_session
          WHERE status = 'completed' AND mode = 'pvp' AND opponent_user_id IS NOT NULL ${sinceFragment}
        )
        SELECT COUNT(*)::bigint AS total
        FROM (
          SELECT pid FROM participant_sessions WHERE pid IS NOT NULL GROUP BY pid HAVING COUNT(*) >= 1
        ) sub
      `,
      this.prisma.$queryRaw<Array<{ participants: bigint; completedMatches: bigint }>>`
        WITH participant_sessions AS (
          SELECT user_id AS pid
          FROM learning.battle_session
          WHERE status = 'completed' AND mode = 'bot' ${sinceFragment}
          UNION ALL
          SELECT user_id FROM learning.battle_session
          WHERE status = 'completed' AND mode = 'pvp' ${sinceFragment}
          UNION ALL
          SELECT opponent_user_id FROM learning.battle_session
          WHERE status = 'completed' AND mode = 'pvp' AND opponent_user_id IS NOT NULL ${sinceFragment}
        )
        SELECT
          (
            SELECT COUNT(*)::bigint FROM (
              SELECT pid FROM participant_sessions WHERE pid IS NOT NULL GROUP BY pid
            ) ranked_players
          ) AS participants,
          (
            SELECT COUNT(*)::bigint FROM learning.battle_session
            WHERE status = 'completed' ${sinceFragment}
          ) AS "completedMatches"
      `
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
