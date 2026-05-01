import { Injectable, NotFoundException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import type { z } from "zod";
import type {
  adminLearningReviewProblemQuerySchema,
  adminLearningReviewRetentionQuerySchema
} from "@nihongo-bjt/shared";

type ProblemInput = z.infer<typeof adminLearningReviewProblemQuerySchema>;
type RetentionInput = z.infer<typeof adminLearningReviewRetentionQuerySchema>;

const TARGET_TYPE = "learning.user_flashcard";
const RATING_GOOD = new Set(["good", "easy"]);

@Injectable()
export class LearningReviewAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  /**
   * High-level summary: total cards, due-now, leeched, average ease/lapses, retention over window.
   */
  async summary(input: RetentionInput) {
    const since = new Date(Date.now() - input.windowDays * 24 * 60 * 60 * 1000);
    const [
      totalCards,
      dueNow,
      leeched,
      reviewsTotal,
      reviewsByRating,
      averages
    ] = await Promise.all([
      this.prisma.userFlashcard.count(),
      this.prisma.userFlashcard.count({ where: { dueAt: { lte: new Date() } } }),
      this.prisma.userFlashcard.count({ where: { leeched: true } }),
      this.prisma.reviewEvent.count({ where: { reviewedAt: { gte: since } } }),
      this.prisma.reviewEvent.groupBy({
        by: ["rating"],
        _count: { _all: true },
        where: { reviewedAt: { gte: since } }
      }),
      this.prisma.userFlashcard.aggregate({
        _avg: { easeFactor: true, lapses: true, intervalDays: true }
      })
    ]);

    const ratings = reviewsByRating.reduce<Record<string, number>>((acc, row) => {
      acc[row.rating] = row._count._all;
      return acc;
    }, {});
    const goodCount = (ratings.good ?? 0) + (ratings.easy ?? 0);
    const retentionPct = reviewsTotal > 0 ? (goodCount / reviewsTotal) * 100 : null;

    return {
      windowDays: input.windowDays,
      totalCards,
      dueNow,
      leeched,
      reviewsTotal,
      reviewsByRating: ratings,
      retentionPct,
      avgEaseFactor: averages._avg.easeFactor,
      avgLapses: averages._avg.lapses,
      avgIntervalDays: averages._avg.intervalDays
    };
  }

  /**
   * Daily retention curve: for each day in the window, ratio of good/easy reviews to total reviews.
   */
  async retentionCurve(input: RetentionInput) {
    const since = new Date(Date.now() - input.windowDays * 24 * 60 * 60 * 1000);
    // Use raw SQL for date_trunc (timezone fixed to UTC).
    const rows = await this.prisma.$queryRaw<
      Array<{ day: Date; total: bigint; good: bigint }>
    >(Prisma.sql`
      SELECT date_trunc('day', "reviewed_at") AS day,
             COUNT(*)::bigint AS total,
             SUM(CASE WHEN rating IN ('good','easy') THEN 1 ELSE 0 END)::bigint AS good
      FROM learning.review_event
      WHERE "reviewed_at" >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC
    `);
    return rows.map((row) => {
      const total = Number(row.total);
      const good = Number(row.good);
      return {
        day: row.day.toISOString().slice(0, 10),
        total,
        good,
        retentionPct: total > 0 ? (good / total) * 100 : null
      };
    });
  }

  /**
   * Problem cards: cards with high lapses or low recent retention. Aggregates per-card recent
   * review stats (last 30 days) so admins can decide whether to force-reintroduce.
   */
  async problemCards(input: ProblemInput) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const where: Prisma.UserFlashcardWhereInput = {
      lapses: { gte: input.minLapses }
    };
    if (input.leeched === "leeched") where.leeched = true;
    else if (input.leeched === "non_leeched") where.leeched = false;
    if (input.q) {
      where.card = {
        OR: [
          { frontText: { contains: input.q, mode: "insensitive" } },
          { backText: { contains: input.q, mode: "insensitive" } }
        ]
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.userFlashcard.findMany({
        include: {
          card: { select: { id: true, frontText: true, backText: true, reading: true } }
        },
        orderBy: [{ lapses: "desc" }, { updatedAt: "desc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.userFlashcard.count({ where })
    ]);

    if (items.length === 0) {
      return { items: [], total, page: input.page, pageSize: input.pageSize };
    }

    const ids = items.map((it) => it.id);
    const recent = await this.prisma.reviewEvent.groupBy({
      by: ["userFlashcardId", "rating"],
      _count: { _all: true },
      where: { userFlashcardId: { in: ids }, reviewedAt: { gte: since } }
    });
    const buckets = new Map<string, { total: number; good: number }>();
    for (const row of recent) {
      const bucket = buckets.get(row.userFlashcardId) ?? { total: 0, good: 0 };
      bucket.total += row._count._all;
      if (RATING_GOOD.has(row.rating)) bucket.good += row._count._all;
      buckets.set(row.userFlashcardId, bucket);
    }

    const enriched = items.map((row) => {
      const b = buckets.get(row.id) ?? { total: 0, good: 0 };
      const recentRetentionPct = b.total > 0 ? (b.good / b.total) * 100 : null;
      return { ...row, recentReviews: b.total, recentRetentionPct };
    });

    // Apply maxRetention filter post-aggregation (UI filter; we cannot do it in SQL easily here)
    const filtered = enriched.filter((row) => {
      if (row.recentRetentionPct === null) return true;
      return row.recentRetentionPct <= input.maxRetention;
    });

    return { items: filtered, total: filtered.length, page: input.page, pageSize: input.pageSize };
  }

  async detail(userFlashcardId: string) {
    const card = await this.prisma.userFlashcard.findUnique({
      include: {
        card: { select: { id: true, frontText: true, backText: true, reading: true } },
        reviews: { orderBy: { reviewedAt: "desc" }, take: 30 }
      },
      where: { id: userFlashcardId }
    });
    if (!card) return null;
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
      where: { targetId: userFlashcardId, targetType: TARGET_TYPE }
    });
    return { ...card, audit };
  }

  /**
   * Force re-introduce a card: set dueAt=now, intervalDays=0, repetitions=0, state='relearning'.
   * Always audited; ease factor is preserved so the SRS algorithm continues from prior signal.
   */
  async forceReintroduce(actorId: string, userFlashcardId: string, reason: string) {
    const before = await this.prisma.userFlashcard.findUnique({ where: { id: userFlashcardId } });
    if (!before) throw new NotFoundException("User flashcard not found");
    const updated = await this.prisma.userFlashcard.update({
      data: {
        dueAt: new Date(),
        intervalDays: 0,
        repetitions: 0,
        state: "relearning"
      },
      where: { id: userFlashcardId }
    });
    await this.prisma.adminAuditLog.create({
      data: {
        action: "admin.learning.review.force_reintroduce",
        actorId,
        after: {
          dueAt: updated.dueAt,
          intervalDays: updated.intervalDays,
          repetitions: updated.repetitions,
          state: updated.state
        } as Prisma.InputJsonValue,
        before: {
          dueAt: before.dueAt,
          intervalDays: before.intervalDays,
          repetitions: before.repetitions,
          state: before.state
        } as Prisma.InputJsonValue,
        reason,
        targetId: userFlashcardId,
        targetType: TARGET_TYPE
      }
    });
    return this.detail(userFlashcardId);
  }
}
