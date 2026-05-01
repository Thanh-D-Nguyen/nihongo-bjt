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

const DOMAIN = "system";

export type SystemAnalyticsSummary = {
  domain: typeof DOMAIN;
  range: { from: string; to: string; days: number };
  filtersApplied: { service: boolean; endpointPattern: boolean };
  kpis: AnalyticsKpi[];
  freshness: { lastRollupAt: string | null; status: string | null; sourceTable: string };
  notices: string[];
};

/**
 * System analytics. Real metrics for rollup status, raw event volume by source, and dead-letter
 * queue depth. p95 latency and per-endpoint error rate are not currently rolled up — exposed as
 * `partial_schema_pending` until an APM/log pipeline lands.
 */
@Injectable()
export class AnalyticsSystemAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async summary(filter: AnalyticsCommonFilter): Promise<SystemAnalyticsSummary> {
    const r = resolveAnalyticsRange(filter);
    const [eventsCurrent, eventsPrev, rollupRunsRecent, rollupFailedRecent, dlqDepth, latestRun] = await Promise.all([
      this.prisma.analyticsEvent.count({ where: { createdAt: { gte: r.from, lt: r.to } } }),
      this.prisma.analyticsEvent.count({
        where: { createdAt: { gte: r.previousFrom, lt: r.previousTo } }
      }),
      this.prisma.analyticsRollupRun.count({ where: { startedAt: { gte: r.from, lt: r.to } } }),
      this.prisma.analyticsRollupRun.count({
        where: { startedAt: { gte: r.from, lt: r.to }, status: "failed" }
      }),
      this.dlqDepth(),
      this.prisma.analyticsRollupRun.findFirst({ orderBy: { startedAt: "desc" } })
    ]);

    const rollupErrorRate = rollupRunsRecent > 0 ? rollupFailedRecent / rollupRunsRecent : null;
    const freshnessLagMs = latestRun?.completedAt
      ? Math.max(0, Date.now() - latestRun.completedAt.getTime())
      : null;

    return {
      domain: DOMAIN,
      filtersApplied: {
        endpointPattern: Boolean(filter.endpointPattern),
        service: Boolean(filter.service)
      },
      freshness: {
        lastRollupAt: latestRun?.completedAt?.toISOString() ?? null,
        sourceTable: "analytics.rollup_run",
        status: latestRun?.status ?? null
      },
      kpis: [
        buildKpi({ format: "int", id: "rawEvents", previous: eventsPrev, value: eventsCurrent }),
        buildKpi({ format: "int", id: "rollupRuns", previous: null, value: rollupRunsRecent }),
        buildKpi({
          available: rollupRunsRecent > 0,
          format: "percent",
          id: "rollupErrorRate",
          previous: null,
          unavailableCode: rollupRunsRecent === 0 ? "no_rollup_runs_in_range" : undefined,
          value: rollupErrorRate
        }),
        buildKpi({ format: "int", id: "deadLetterQueueDepth", previous: null, value: dlqDepth }),
        buildKpi({
          available: freshnessLagMs != null,
          format: "duration_ms",
          id: "rollupFreshnessLagMs",
          previous: null,
          unavailableCode: freshnessLagMs == null ? "no_rollup_completed" : undefined,
          value: freshnessLagMs
        })
      ],
      notices: ["partial_schema_pending: api_p95_latency_and_per_endpoint_error_rate_not_rolled_up"],
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
    if (filter.metric === "raw_events") {
      const rows = await this.prisma.analyticsEvent.findMany({
        select: { createdAt: true },
        where: { createdAt: { gte: r.from, lt: r.to } }
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
    if (filter.metric === "rollup_runs") {
      const rows = await this.prisma.analyticsRollupRun.findMany({
        select: { startedAt: true, status: true },
        where: { startedAt: { gte: r.from, lt: r.to } }
      });
      const m = new Map<string, number>();
      for (const r0 of rows) {
        const k = r0.startedAt.toISOString().slice(0, 10);
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
    if (filter.dimension === "by_event_source") {
      const rows = await this.prisma.analyticsEvent.groupBy({
        _count: { _all: true },
        by: ["source"],
        where: { createdAt: { gte: r.from, lt: r.to } }
      });
      const out: AnalyticsBreakdownRow[] = rows.map((r0) => ({
        count: r0._count._all,
        source: r0.source
      }));
      return {
        dimension: filter.dimension,
        domain: DOMAIN,
        page: 1,
        pageSize: out.length,
        rows: out,
        total: out.length
      };
    }
    if (filter.dimension === "by_rollup_status") {
      const rows = await this.prisma.analyticsRollupRun.groupBy({
        _count: { _all: true },
        by: ["status"],
        where: { startedAt: { gte: r.from, lt: r.to } }
      });
      const out: AnalyticsBreakdownRow[] = rows.map((r0) => ({
        count: r0._count._all,
        status: r0.status
      }));
      return {
        dimension: filter.dimension,
        domain: DOMAIN,
        page: 1,
        pageSize: out.length,
        rows: out,
        total: out.length
      };
    }
    // recent_runs
    const list = await this.prisma.analyticsRollupRun.findMany({
      orderBy: { startedAt: "desc" },
      select: {
        completedAt: true,
        id: true,
        metrics: true,
        name: true,
        startedAt: true,
        status: true
      },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize
    });
    const total = await this.prisma.analyticsRollupRun.count();
    const out: AnalyticsBreakdownRow[] = list.map((r0) => ({
      completedAt: r0.completedAt?.toISOString() ?? null,
      durationMs:
        r0.completedAt != null
          ? r0.completedAt.getTime() - r0.startedAt.getTime()
          : null,
      id: r0.id,
      metrics: r0.metrics,
      name: r0.name,
      startedAt: r0.startedAt.toISOString(),
      status: r0.status
    }));
    return {
      dimension: filter.dimension || "recent_runs",
      domain: DOMAIN,
      page: filter.page,
      pageSize: filter.pageSize,
      rows: out,
      total
    };
  }

  private async dlqDepth(): Promise<number> {
    // ops.import_staging or webhook DLQ may not be present in all envs; best-effort.
    try {
      const r = await this.prisma.contentImportError.count({ where: {} });
      return r;
    } catch {
      return 0;
    }
  }
}
