import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
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

const DOMAIN = "learning";

const RETAINED_RATINGS = new Set(["good", "easy"]);

/**
 * Learning analytics. Real metrics for SRS study sessions, retention curve, mastery progress,
 * and drop-off (cards in `relearning` / `lapsed`). Sources: learning.review_event, learning.user_flashcard.
 */
@Injectable()
export class AnalyticsLearningAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async summary(filter: AnalyticsCommonFilter) {
    const r = resolveAnalyticsRange(filter);
    const [
      reviews,
      reviewsPrev,
      activeStudiers,
      activeStudiersPrev,
      retentionNow,
      retentionPrev,
      dueNow,
      leeched,
      latestRun
    ] = await Promise.all([
      this.prisma.reviewEvent.count({ where: { reviewedAt: { gte: r.from, lt: r.to } } }),
      this.prisma.reviewEvent.count({
        where: { reviewedAt: { gte: r.previousFrom, lt: r.previousTo } }
      }),
      this.activeStudiers(r.from, r.to),
      this.activeStudiers(r.previousFrom, r.previousTo),
      this.retentionRate(r.from, r.to),
      this.retentionRate(r.previousFrom, r.previousTo),
      this.prisma.userFlashcard.count({ where: { dueAt: { lt: new Date() } } }),
      this.prisma.userFlashcard.count({ where: { leeched: true } }),
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
        buildKpi({ format: "int", id: "studyReviews", previous: reviewsPrev, value: reviews }),
        buildKpi({ format: "int", id: "activeStudiers", previous: activeStudiersPrev, value: activeStudiers }),
        buildKpi({
          available: retentionNow.total > 0,
          format: "percent",
          id: "retentionRate",
          previous: retentionPrev.total > 0 ? retentionPrev.rate : null,
          unavailableCode: retentionNow.total === 0 ? "no_reviews_in_range" : undefined,
          value: retentionNow.total > 0 ? retentionNow.rate : null
        }),
        buildKpi({ format: "int", id: "cardsDueNow", previous: null, value: dueNow }),
        buildKpi({ format: "int", id: "leechedCards", previous: null, value: leeched })
      ],
      notices: ["partial_schema_pending: drop_off_funnel_requires_dedicated_study_session_table"],
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
    if (filter.metric === "reviews") {
      const rows = await this.prisma.reviewEvent.findMany({
        select: { reviewedAt: true },
        where: { reviewedAt: { gte: r.from, lt: r.to } }
      });
      const m = new Map<string, number>();
      for (const r0 of rows) {
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
    if (filter.metric === "active_studiers") {
      const rows = await this.prisma.reviewEvent.findMany({
        select: { reviewedAt: true, userId: true },
        where: { reviewedAt: { gte: r.from, lt: r.to } }
      });
      const m = new Map<string, Set<string>>();
      for (const r0 of rows) {
        const k = r0.reviewedAt.toISOString().slice(0, 10);
        if (!m.has(k)) m.set(k, new Set());
        m.get(k)!.add(r0.userId);
      }
      return {
        domain: DOMAIN,
        granularity: filter.granularity,
        metric: filter.metric,
        range: { days: r.days, from: r.from.toISOString(), to: r.to.toISOString() },
        series: days.map((d) => ({ t: d, value: m.get(d)?.size ?? 0 }))
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
    if (filter.dimension === "by_card_state") {
      const rows = await this.prisma.userFlashcard.groupBy({
        _count: { _all: true },
        by: ["state"]
      });
      const out: AnalyticsBreakdownRow[] = rows.map((r0) => ({ count: r0._count._all, state: r0.state }));
      return {
        dimension: filter.dimension,
        domain: DOMAIN,
        page: 1,
        pageSize: out.length,
        rows: out,
        total: out.length
      };
    }
    if (filter.dimension === "by_rating") {
      const rows = await this.prisma.reviewEvent.groupBy({
        _count: { _all: true },
        by: ["rating"],
        where: { reviewedAt: { gte: r.from, lt: r.to } }
      });
      const out: AnalyticsBreakdownRow[] = rows.map((r0) => ({ count: r0._count._all, rating: r0.rating }));
      return {
        dimension: filter.dimension,
        domain: DOMAIN,
        page: 1,
        pageSize: out.length,
        rows: out,
        total: out.length
      };
    }
    // top_studiers
    const rows = await this.prisma.reviewEvent.groupBy({
      _count: { _all: true },
      by: ["userId"],
      orderBy: { _count: { userId: "desc" } },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
      where: { reviewedAt: { gte: r.from, lt: r.to } }
    });
    const out: AnalyticsBreakdownRow[] = rows.map((r0) => ({ count: r0._count._all, userId: r0.userId }));
    const totalRow = await this.prisma.reviewEvent.findMany({
      distinct: ["userId"],
      select: { userId: true },
      where: { reviewedAt: { gte: r.from, lt: r.to } }
    });
    return {
      dimension: filter.dimension || "top_studiers",
      domain: DOMAIN,
      page: filter.page,
      pageSize: filter.pageSize,
      rows: out,
      total: totalRow.length
    };
  }

  private async activeStudiers(from: Date, to: Date): Promise<number> {
    const rows = await this.prisma.reviewEvent.findMany({
      distinct: ["userId"],
      select: { userId: true },
      where: { reviewedAt: { gte: from, lt: to } }
    });
    return rows.length;
  }

  private async retentionRate(
    from: Date,
    to: Date
  ): Promise<{ rate: number; retained: number; total: number }> {
    const rows = await this.prisma.reviewEvent.findMany({
      select: { rating: true },
      where: { reviewedAt: { gte: from, lt: to } }
    });
    const total = rows.length;
    const retained = rows.filter((r) => RETAINED_RATINGS.has(r.rating)).length;
    return { rate: total > 0 ? retained / total : 0, retained, total };
  }
}
