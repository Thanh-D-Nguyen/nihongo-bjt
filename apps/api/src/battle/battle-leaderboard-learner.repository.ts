import { Injectable } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";

import { battleLearnerLeaderboardQuerySchema } from "@nihongo-bjt/shared";
import type { z } from "zod";

type ListInput = z.infer<typeof battleLearnerLeaderboardQuerySchema> & {
  viewerUserId: string | null;
};

type RankedRow = {
  avgScore: number;
  displayName: string;
  isYou: boolean;
  losses: number;
  rank: number;
  totalMatches: number;
  wins: number;
};

@Injectable()
export class BattleLeaderboardLearnerRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(input: ListInput) {
    const since = this.windowToDate(input.window);
    const sinceFragment = since
      ? Prisma.sql`AND started_at >= ${since}`
      : Prisma.empty;
    const limit = input.pageSize;
    const offset = (input.page - 1) * input.pageSize;
    const viewerId = input.viewerUserId;

    const isYouExpr =
      viewerId != null
        ? Prisma.sql`(r.user_id = ${viewerId}::uuid)`
        : Prisma.sql`false`;

    const participantSessions = Prisma.sql`
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
      ),
      board AS (
        SELECT
          pid AS user_id,
          COUNT(*) FILTER (WHERE my_score > their_score) AS wins,
          COUNT(*) FILTER (WHERE my_score < their_score) AS losses,
          COUNT(*) AS total_matches,
          ROUND(AVG(my_score)::numeric, 1)::double precision AS avg_score
        FROM participant_sessions
        WHERE pid IS NOT NULL
        GROUP BY pid
        HAVING COUNT(*) >= 1
      ),
      ranked AS (
        SELECT
          b.user_id,
          b.wins,
          b.losses,
          b.total_matches,
          b.avg_score,
          up.display_name AS display_name,
          ROW_NUMBER() OVER (ORDER BY b.wins DESC, b.avg_score DESC, b.user_id ASC) AS rank
        FROM board b
        INNER JOIN profile.user_profile up ON up.id = b.user_id AND up.status = 'active'
      )
    `;

    const [items, totalRow, summaryRow, viewerRows] = await Promise.all([
      this.prisma.$queryRaw<RankedRow[]>`
        ${participantSessions}
        SELECT
          r.rank::int AS rank,
          r.display_name AS "displayName",
          r.wins::int AS wins,
          r.losses::int AS losses,
          r.total_matches::int AS "totalMatches",
          r.avg_score::float AS "avgScore",
          ${isYouExpr} AS "isYou"
        FROM ranked r
        ORDER BY r.rank ASC
        LIMIT ${limit} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<Array<{ total: bigint }>>`
        ${participantSessions}
        SELECT COUNT(*)::bigint AS total FROM ranked
      `,
      this.prisma.$queryRaw<Array<{ completedMatches: bigint; participants: bigint }>>`
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
      `,
      viewerId
        ? this.prisma.$queryRaw<
            Array<{
              avgScore: number;
              displayName: string;
              losses: number;
              rank: number;
              totalMatches: number;
              wins: number;
            }>
          >`
        ${participantSessions}
        SELECT
          r.rank::int AS rank,
          r.display_name AS "displayName",
          r.wins::int AS wins,
          r.losses::int AS losses,
          r.total_matches::int AS "totalMatches",
          r.avg_score::float AS "avgScore"
        FROM ranked r
        WHERE r.user_id = ${viewerId}::uuid
      `
        : Promise.resolve([])
    ]);

    const total = Number(totalRow[0]?.total ?? 0n);
    const summary = summaryRow[0];
    const viewerEntry = viewerRows[0];

    return {
      items: items.map((r) => ({
        avgScore: Number(r.avgScore ?? 0),
        displayName: r.displayName,
        isYou: Boolean(r.isYou),
        losses: r.losses,
        rank: r.rank,
        totalMatches: r.totalMatches,
        winRate:
          r.totalMatches > 0
            ? Number(((r.wins / r.totalMatches) * 100).toFixed(1))
            : 0,
        wins: r.wins
      })),
      page: input.page,
      pageSize: input.pageSize,
      summary: {
        completedMatches: Number(summary?.completedMatches ?? 0n),
        since: since?.toISOString() ?? null,
        totalParticipants: Number(summary?.participants ?? 0n),
        window: input.window
      },
      total,
      viewerRank: viewerEntry
        ? {
            avgScore: Number(viewerEntry.avgScore ?? 0),
            displayName: viewerEntry.displayName,
            losses: viewerEntry.losses,
            rank: viewerEntry.rank,
            totalMatches: viewerEntry.totalMatches,
            winRate:
              viewerEntry.totalMatches > 0
                ? Number(((viewerEntry.wins / viewerEntry.totalMatches) * 100).toFixed(1))
                : 0,
            wins: viewerEntry.wins
          }
        : null
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
