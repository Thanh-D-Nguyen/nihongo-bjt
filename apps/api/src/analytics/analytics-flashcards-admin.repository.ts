import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import { Injectable } from "@nestjs/common";

import {
  type AnalyticsBreakdownRow,
  type AnalyticsCommonFilter,
  type AnalyticsKpi,
  type AnalyticsTimeseriesPoint,
  buildKpi,
  dayBucketsBetween,
  resolveAnalyticsRange
} from "./analytics-admin.shared.js";

const DOMAIN = "flashcards";

const RETAINED_RATINGS = new Set(["good", "easy"]);

export type FlashcardsAnalyticsSummary = {
  domain: typeof DOMAIN;
  range: { from: string; to: string; days: number };
  filtersApplied: { deckId: boolean; topic: boolean };
  kpis: AnalyticsKpi[];
  freshness: { lastRollupAt: string | null; status: string | null; sourceTable: string };
};

@Injectable()
export class AnalyticsFlashcardsAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async summary(filter: AnalyticsCommonFilter): Promise<FlashcardsAnalyticsSummary> {
    const r = resolveAnalyticsRange(filter);
    const where = this.reviewWhere(filter);
    const [reviews, reviewsPrev, retention, retentionPrev, masteryDelta, decksCompleted, decksCompletedPrev, latestRun] =
      await Promise.all([
        this.prisma.reviewEvent.count({ where: { ...where, reviewedAt: { gte: r.from, lt: r.to } } }),
        this.prisma.reviewEvent.count({
          where: { ...where, reviewedAt: { gte: r.previousFrom, lt: r.previousTo } }
        }),
        this.retentionRate(r.from, r.to, where),
        this.retentionRate(r.previousFrom, r.previousTo, where),
        this.masteryDelta(r.from, r.to, where),
        this.decksCompletedCount(r.from, r.to, filter.deckId),
        this.decksCompletedCount(r.previousFrom, r.previousTo, filter.deckId),
        this.prisma.analyticsRollupRun.findFirst({ orderBy: { startedAt: "desc" } })
      ]);

    return {
      domain: DOMAIN,
      filtersApplied: { deckId: Boolean(filter.deckId), topic: Boolean(filter.topic) },
      freshness: {
        lastRollupAt: latestRun?.completedAt?.toISOString() ?? null,
        sourceTable: "learning.review_event",
        status: latestRun?.status ?? null
      },
      kpis: [
        buildKpi({ format: "int", id: "cardsReviewed", previous: reviewsPrev, value: reviews }),
        buildKpi({
          available: retention.total > 0,
          format: "percent",
          id: "retentionRate",
          previous: retentionPrev.total > 0 ? retentionPrev.rate : null,
          unavailableCode: retention.total === 0 ? "no_reviews_in_range" : undefined,
          value: retention.total > 0 ? retention.rate : null
        }),
        buildKpi({
          available: true,
          format: "int",
          id: "masteredCardsDelta",
          previous: null,
          value: masteryDelta
        }),
        buildKpi({ format: "int", id: "decksCompleted", previous: decksCompletedPrev, value: decksCompleted }),
        buildKpi({
          available: retention.total > 0,
          format: "int",
          id: "lapsedReviews",
          previous: null,
          value: retention.total - retention.retained
        })
      ],
      range: { days: r.days, from: r.from.toISOString(), to: r.to.toISOString() }
    };
  }

  async timeseries(filter: AnalyticsCommonFilter & { metric: string; granularity: "day" | "hour" }) {
    const r = resolveAnalyticsRange(filter);
    if (filter.granularity !== "day") {
      return {
        domain: DOMAIN,
        granularity: filter.granularity,
        metric: filter.metric,
        notice: "granularity_not_supported",
        series: [] as AnalyticsTimeseriesPoint[]
      };
    }
    const days = dayBucketsBetween(r.from, r.to);
    const where = this.reviewWhere(filter);
    if (filter.metric === "reviews") {
      const reviews = await this.prisma.reviewEvent.findMany({
        select: { reviewedAt: true },
        where: { ...where, reviewedAt: { gte: r.from, lt: r.to } }
      });
      const m = new Map<string, number>();
      for (const r0 of reviews) {
        const k = r0.reviewedAt.toISOString().slice(0, 10);
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return {
        domain: DOMAIN,
        granularity: filter.granularity,
        metric: filter.metric,
        range: { days: r.days, from: r.from.toISOString(), to: r.to.toISOString() },
        series: days.map((d) => ({ t: d, value: m.get(d) ?? 0 }))
      };
    }
    if (filter.metric === "retention") {
      const rows = await this.prisma.reviewEvent.findMany({
        select: { rating: true, reviewedAt: true },
        where: { ...where, reviewedAt: { gte: r.from, lt: r.to } }
      });
      const m = new Map<string, { total: number; ret: number }>();
      for (const r0 of rows) {
        const k = r0.reviewedAt.toISOString().slice(0, 10);
        const v = m.get(k) ?? { ret: 0, total: 0 };
        v.total += 1;
        if (RETAINED_RATINGS.has(r0.rating)) v.ret += 1;
        m.set(k, v);
      }
      return {
        domain: DOMAIN,
        granularity: filter.granularity,
        metric: filter.metric,
        range: { days: r.days, from: r.from.toISOString(), to: r.to.toISOString() },
        series: days.map((d) => {
          const v = m.get(d);
          return { t: d, value: v && v.total > 0 ? v.ret / v.total : 0 };
        })
      };
    }
    return {
      domain: DOMAIN,
      granularity: filter.granularity,
      metric: filter.metric,
      notice: "unknown_metric",
      series: [] as AnalyticsTimeseriesPoint[]
    };
  }

  async breakdown(filter: AnalyticsCommonFilter & { dimension: string; page: number; pageSize: number }) {
    const r = resolveAnalyticsRange(filter);
    if (filter.dimension === "by_deck") {
      // Map reviews → user_flashcard → flashcard_variant → deck via deck_card.
      const rows = await this.prisma.$queryRaw<
        { deck_id: string; title_vi: string | null; reviews: bigint; retained: bigint }[]
      >`
        select
          dc.deck_id::text as deck_id,
          d.title_vi as title_vi,
          count(*)::bigint as reviews,
          count(*) filter (where re.rating in ('good','easy'))::bigint as retained
        from learning.review_event re
        join learning.user_flashcard uf on uf.id = re.user_flashcard_id
        join learning.deck_card dc on dc.card_id = uf.card_id
        join learning.deck d on d.id = dc.deck_id
        where re.reviewed_at >= ${r.from} and re.reviewed_at < ${r.to}
        group by dc.deck_id, d.title_vi
        order by reviews desc
        limit ${filter.pageSize} offset ${(filter.page - 1) * filter.pageSize}
      `.catch(() => [] as { deck_id: string; title_vi: string | null; reviews: bigint; retained: bigint }[]);
      const totalRows = await this.prisma.$queryRaw<{ c: bigint }[]>`
        select count(distinct dc.deck_id)::bigint as c
        from learning.review_event re
        join learning.user_flashcard uf on uf.id = re.user_flashcard_id
        join learning.deck_card dc on dc.card_id = uf.card_id
        where re.reviewed_at >= ${r.from} and re.reviewed_at < ${r.to}
      `.catch(() => [{ c: 0n } as { c: bigint }]);
      const out: AnalyticsBreakdownRow[] = rows.map((row) => ({
        deckId: row.deck_id,
        deckTitle: row.title_vi ?? row.deck_id,
        retained: Number(row.retained),
        retentionRate:
          Number(row.reviews) > 0 ? Number(row.retained) / Number(row.reviews) : 0,
        reviews: Number(row.reviews)
      }));
      return {
        dimension: filter.dimension,
        domain: DOMAIN,
        page: filter.page,
        pageSize: filter.pageSize,
        rows: out,
        total: Number(totalRows[0]?.c ?? 0n)
      };
    }
    // by_rating
    const rows = await this.prisma.reviewEvent.groupBy({
      _count: { _all: true },
      by: ["rating"],
      where: this.reviewWhere(filter, r.from, r.to)
    });
    const total = rows.reduce((a, r0) => a + r0._count._all, 0);
    const out: AnalyticsBreakdownRow[] = rows.map((r0) => ({
      count: r0._count._all,
      rating: r0.rating,
      share: total > 0 ? r0._count._all / total : 0
    }));
    return {
      dimension: filter.dimension || "by_rating",
      domain: DOMAIN,
      page: 1,
      pageSize: out.length,
      rows: out,
      total: out.length
    };
  }

  private reviewWhere(filter: AnalyticsCommonFilter, from?: Date, to?: Date): Prisma.ReviewEventWhereInput {
    const where: Prisma.ReviewEventWhereInput = {};
    if (from && to) where.reviewedAt = { gte: from, lt: to };
    if (filter.deckId) {
      where.userFlashcard = {
        card: { deckLinks: { some: { deckId: filter.deckId } } }
      };
    }
    return where;
  }

  private async retentionRate(from: Date, to: Date, w: Prisma.ReviewEventWhereInput) {
    const rows = await this.prisma.reviewEvent.findMany({
      select: { rating: true },
      where: { ...w, reviewedAt: { gte: from, lt: to } }
    });
    if (rows.length === 0) return { rate: 0, retained: 0, total: 0 };
    const retained = rows.filter((r) => RETAINED_RATINGS.has(r.rating)).length;
    return { rate: retained / rows.length, retained, total: rows.length };
  }

  private async masteryDelta(from: Date, to: Date, w: Prisma.ReviewEventWhereInput): Promise<number> {
    // Approximation: count of cards transitioning to state "review" or "mastered" during window via repetitions reaching threshold.
    // We don't have an explicit state-change log, so estimate via reviewedAt + lapses=0 + repetitions>=4.
    const _ = w; // not used in this approximation
    const rows = await this.prisma.userFlashcard.findMany({
      select: { id: true },
      where: {
        lapses: 0,
        repetitions: { gte: 4 },
        updatedAt: { gte: from, lt: to }
      }
    });
    return rows.length;
  }

  private async decksCompletedCount(from: Date, to: Date, deckId?: string): Promise<number> {
    // Approximation: deck "completed" when every deck card has a userFlashcard with state in ('review','mastered').
    // Heavy aggregation; approximate by counting decks where all user flashcard repetitions >= 4 in window.
    const rows = await this.prisma.$queryRaw<{ c: bigint }[]>`
      select count(distinct dc.deck_id)::bigint as c
      from learning.user_flashcard uf
      join learning.deck_card dc on dc.card_id = uf.card_id
      where uf.repetitions >= 4 and uf.lapses = 0
        and uf.updated_at >= ${from} and uf.updated_at < ${to}
        ${deckId ? Prisma.sql`and dc.deck_id = ${deckId}::uuid` : Prisma.empty}
    `.catch(() => [{ c: 0n } as { c: bigint }]);
    return Number(rows[0]?.c ?? 0n);
  }
}
