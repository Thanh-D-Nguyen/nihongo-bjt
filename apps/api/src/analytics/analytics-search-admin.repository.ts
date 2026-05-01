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

const DOMAIN = "search";

const SEARCH_EVENT_NAMES = ["search.query", "search.result.click", "search.zero_result"] as const;

/**
 * Search analytics. Real metrics derived from `analytics.analytics_event` rows with source=`search`
 * or eventName starting with `search.`. Top queries and zero-result patterns require a search event
 * stream — when the table contains relevant rows we surface them; otherwise we mark `partial_schema_pending`.
 */
@Injectable()
export class AnalyticsSearchAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async summary(filter: AnalyticsCommonFilter) {
    const r = resolveAnalyticsRange(filter);
    const where = { eventName: { in: [...SEARCH_EVENT_NAMES] } } as const;
    const [queriesNow, queriesPrev, zeroResultsNow, clicksNow] = await Promise.all([
      this.prisma.analyticsEvent.count({
        where: { ...where, eventName: "search.query", createdAt: { gte: r.from, lt: r.to } }
      }),
      this.prisma.analyticsEvent.count({
        where: {
          eventName: "search.query",
          createdAt: { gte: r.previousFrom, lt: r.previousTo }
        }
      }),
      this.prisma.analyticsEvent.count({
        where: { eventName: "search.zero_result", createdAt: { gte: r.from, lt: r.to } }
      }),
      this.prisma.analyticsEvent.count({
        where: { eventName: "search.result.click", createdAt: { gte: r.from, lt: r.to } }
      })
    ]);
    const ctr = queriesNow > 0 ? clicksNow / queriesNow : null;
    const zeroRate = queriesNow > 0 ? zeroResultsNow / queriesNow : null;

    const latestRun = await this.prisma.analyticsRollupRun.findFirst({ orderBy: { startedAt: "desc" } });
    const partial = queriesNow === 0 && zeroResultsNow === 0 && clicksNow === 0;

    return {
      domain: DOMAIN,
      filtersApplied: { source: Boolean(filter.source) },
      freshness: {
        lastRollupAt: latestRun?.completedAt?.toISOString() ?? null,
        sourceTable: "analytics.analytics_event",
        status: latestRun?.status ?? null
      },
      kpis: [
        buildKpi({ format: "int", id: "searchQueries", previous: queriesPrev, value: queriesNow }),
        buildKpi({
          available: queriesNow > 0,
          format: "percent",
          id: "zeroResultRate",
          previous: null,
          unavailableCode: queriesNow === 0 ? "no_search_events_in_range" : undefined,
          value: zeroRate
        }),
        buildKpi({
          available: queriesNow > 0,
          format: "percent",
          id: "clickThroughRate",
          previous: null,
          unavailableCode: queriesNow === 0 ? "no_search_events_in_range" : undefined,
          value: ctr
        }),
        buildKpi({ format: "int", id: "zeroResultCount", previous: null, value: zeroResultsNow }),
        buildKpi({ format: "int", id: "resultClicks", previous: null, value: clicksNow })
      ],
      notices: partial
        ? ["partial_schema_pending: no_search_events_recorded_emit_search.query/zero_result/click"]
        : [],
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
    const targetEvent =
      filter.metric === "queries"
        ? "search.query"
        : filter.metric === "zero_results"
          ? "search.zero_result"
          : filter.metric === "clicks"
            ? "search.result.click"
            : null;
    if (!targetEvent) {
      return {
        domain: DOMAIN,
        granularity: filter.granularity,
        metric: filter.metric,
        notice: "unknown_metric",
        series: [] as AnalyticsTimeseriesPoint[]
      };
    }
    const rows = await this.prisma.analyticsEvent.findMany({
      select: { createdAt: true },
      where: { eventName: targetEvent, createdAt: { gte: r.from, lt: r.to } }
    });
    const m = new Map<string, number>();
    for (const r0 of rows) {
      const k = r0.createdAt.toISOString().slice(0, 10);
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

  async breakdown(filter: AnalyticsCommonFilter & { dimension: string; page: number; pageSize: number }) {
    const r = resolveAnalyticsRange(filter);
    if (filter.dimension === "top_queries" || filter.dimension === "zero_result_queries") {
      const eventName = filter.dimension === "top_queries" ? "search.query" : "search.zero_result";
      const rows = await this.prisma.analyticsEvent.findMany({
        select: { payload: true },
        take: 5_000,
        where: { eventName, createdAt: { gte: r.from, lt: r.to } }
      });
      const counts = new Map<string, number>();
      for (const r0 of rows) {
        const q = (r0.payload as Record<string, unknown> | null)?.query;
        const key = typeof q === "string" ? q.trim().toLowerCase() : "";
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      const total = sorted.length;
      const slice = sorted.slice((filter.page - 1) * filter.pageSize, filter.page * filter.pageSize);
      const out: AnalyticsBreakdownRow[] = slice.map(([query, count]) => ({ query, count }));
      return {
        dimension: filter.dimension,
        domain: DOMAIN,
        page: filter.page,
        pageSize: filter.pageSize,
        rows: out,
        total
      };
    }
    if (filter.dimension === "by_source") {
      const rows = await this.prisma.analyticsEvent.groupBy({
        _count: { _all: true },
        by: ["source"],
        where: { eventName: { in: [...SEARCH_EVENT_NAMES] }, createdAt: { gte: r.from, lt: r.to } }
      });
      const out: AnalyticsBreakdownRow[] = rows.map((r0) => ({ count: r0._count._all, source: r0.source }));
      return {
        dimension: filter.dimension,
        domain: DOMAIN,
        page: 1,
        pageSize: out.length,
        rows: out,
        total: out.length
      };
    }
    return {
      dimension: filter.dimension || "top_queries",
      domain: DOMAIN,
      notice: "unknown_dimension",
      page: 1,
      pageSize: 0,
      rows: [],
      total: 0
    };
  }
}
