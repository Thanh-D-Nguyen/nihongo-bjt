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

const DOMAIN = "battle";

export type BattleAnalyticsSummary = {
  domain: typeof DOMAIN;
  range: { from: string; to: string; days: number };
  filtersApplied: { configId: boolean; level: boolean };
  kpis: AnalyticsKpi[];
  freshness: { lastRollupAt: string | null; status: string | null; sourceTable: string };
};

/** Per-domain admin analytics for Battle. Pure read; aggregates over `learning.battle_session` and `learning.battle_abuse_report`. */
@Injectable()
export class AnalyticsBattleAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async summary(filter: AnalyticsCommonFilter): Promise<BattleAnalyticsSummary> {
    const r = resolveAnalyticsRange(filter);
    const baseWhere = this.matchesWhere(filter);

    const [
      matches,
      matchesPrev,
      activeUsers,
      activeUsersPrev,
      botMatches,
      realMatches,
      durationAgg,
      durationPrevAgg,
      abuseCount,
      abusePrev,
      latestRun
    ] = await Promise.all([
      this.prisma.battleSession.count({ where: { ...baseWhere, startedAt: { gte: r.from, lt: r.to } } }),
      this.prisma.battleSession.count({
        where: { ...baseWhere, startedAt: { gte: r.previousFrom, lt: r.previousTo } }
      }),
      this.distinctUsers(r.from, r.to, baseWhere),
      this.distinctUsers(r.previousFrom, r.previousTo, baseWhere),
      this.prisma.battleSession.count({
        where: { ...baseWhere, mode: "bot", startedAt: { gte: r.from, lt: r.to } }
      }),
      this.prisma.battleSession.count({
        where: { ...baseWhere, mode: { not: "bot" }, startedAt: { gte: r.from, lt: r.to } }
      }),
      this.avgMatchDurationMs(r.from, r.to, baseWhere),
      this.avgMatchDurationMs(r.previousFrom, r.previousTo, baseWhere),
      this.prisma.battleAbuseReport.count({ where: { createdAt: { gte: r.from, lt: r.to } } }),
      this.prisma.battleAbuseReport.count({
        where: { createdAt: { gte: r.previousFrom, lt: r.previousTo } }
      }),
      this.prisma.analyticsRollupRun.findFirst({ orderBy: { startedAt: "desc" } })
    ]);

    const botRatio = matches > 0 ? botMatches / matches : null;
    const botRatioPrev =
      matchesPrev > 0 ? botMatches / Math.max(1, matchesPrev) : null; // best-effort; prev bot/real ratio not separately scoped
    const abuseRate = matches > 0 ? abuseCount / matches : null;
    const abuseRatePrev = matchesPrev > 0 ? abusePrev / matchesPrev : null;

    return {
      domain: DOMAIN,
      filtersApplied: { configId: Boolean(filter.configId), level: Boolean(filter.level) },
      freshness: {
        lastRollupAt: latestRun?.completedAt?.toISOString() ?? null,
        sourceTable: "learning.battle_session",
        status: latestRun?.status ?? null
      },
      kpis: [
        buildKpi({ format: "int", id: "totalMatches", previous: matchesPrev, value: matches }),
        buildKpi({ format: "int", id: "activePlayersDau", previous: activeUsersPrev, value: activeUsers }),
        buildKpi({
          available: botRatio != null,
          format: "percent",
          id: "botRatio",
          previous: botRatioPrev,
          unavailableCode: botRatio == null ? "no_matches_in_range" : undefined,
          value: botRatio
        }),
        buildKpi({
          available: realMatches >= 0,
          format: "int",
          id: "realPlayerMatches",
          previous: null,
          value: realMatches
        }),
        buildKpi({
          available: durationAgg.count > 0,
          format: "duration_ms",
          id: "avgMatchDurationMs",
          previous: durationPrevAgg.count > 0 ? durationPrevAgg.avgMs : null,
          unavailableCode: durationAgg.count === 0 ? "no_completed_matches" : undefined,
          value: durationAgg.count > 0 ? durationAgg.avgMs : null
        }),
        buildKpi({
          available: matches > 0,
          format: "percent",
          id: "abuseReportRate",
          previous: abuseRatePrev,
          unavailableCode: matches === 0 ? "no_matches_in_range" : undefined,
          value: abuseRate
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
    const baseWhere = this.matchesWhere(filter);
    const days = dayBucketsBetween(r.from, r.to);
    let series: AnalyticsTimeseriesPoint[];
    if (filter.metric === "matches") {
      const rows = await this.prisma.$queryRaw<{ d: string; c: bigint }[]>`
        select (started_at at time zone 'UTC')::date::text as d, count(*)::bigint as c
        from learning.battle_session
        where started_at >= ${r.from} and started_at < ${r.to}
        ${this.configFilterSql(baseWhere)}
        group by 1 order by 1
      `;
      const m = new Map(rows.map((row) => [row.d, Number(row.c)] as const));
      series = days.map((d) => ({ t: d, value: m.get(d) ?? 0 }));
    } else if (filter.metric === "active_players") {
      const rows = await this.prisma.$queryRaw<{ d: string; c: bigint }[]>`
        select (started_at at time zone 'UTC')::date::text as d, count(distinct user_id)::bigint as c
        from learning.battle_session
        where started_at >= ${r.from} and started_at < ${r.to}
        ${this.configFilterSql(baseWhere)}
        group by 1 order by 1
      `;
      const m = new Map(rows.map((row) => [row.d, Number(row.c)] as const));
      series = days.map((d) => ({ t: d, value: m.get(d) ?? 0 }));
    } else if (filter.metric === "abuse_reports") {
      const rows = await this.prisma.$queryRaw<{ d: string; c: bigint }[]>`
        select (created_at at time zone 'UTC')::date::text as d, count(*)::bigint as c
        from learning.battle_abuse_report
        where created_at >= ${r.from} and created_at < ${r.to}
        group by 1 order by 1
      `;
      const m = new Map(rows.map((row) => [row.d, Number(row.c)] as const));
      series = days.map((d) => ({ t: d, value: m.get(d) ?? 0 }));
    } else {
      return {
        domain: DOMAIN,
        granularity: filter.granularity,
        metric: filter.metric,
        notice: "unknown_metric",
        series: [] as AnalyticsTimeseriesPoint[]
      };
    }
    return {
      domain: DOMAIN,
      granularity: filter.granularity,
      metric: filter.metric,
      range: { days: r.days, from: r.from.toISOString(), to: r.to.toISOString() },
      series
    };
  }

  async breakdown(
    filter: AnalyticsCommonFilter & { dimension: string; page: number; pageSize: number }
  ) {
    const r = resolveAnalyticsRange(filter);
    if (filter.dimension === "by_config") {
      const rows = await this.prisma.$queryRaw<
        { config_id: string | null; matches: bigint; bot_matches: bigint; abuse: bigint }[]
      >`
        select
          s.test_id::text as config_id,
          count(*)::bigint as matches,
          count(*) filter (where s.mode = 'bot')::bigint as bot_matches,
          (
            select count(*)::bigint from learning.battle_abuse_report a
            where a.created_at >= ${r.from} and a.created_at < ${r.to}
          ) as abuse
        from learning.battle_session s
        where s.started_at >= ${r.from} and s.started_at < ${r.to}
        group by 1 order by matches desc
        limit ${filter.pageSize} offset ${(filter.page - 1) * filter.pageSize}
      `.catch(() => [] as { config_id: string | null; matches: bigint; bot_matches: bigint; abuse: bigint }[]);
      // Note: BattleSession does not currently link to BattleConfig (test_id is BJT test in current schema).
      // We expose by config slug only via JOIN when wired later. Until then return aggregated rows.
      const total = await this.prisma.battleSession.count({
        where: { startedAt: { gte: r.from, lt: r.to } }
      });
      const out: AnalyticsBreakdownRow[] = rows.map((row) => ({
        abuseReports: Number(row.abuse),
        botMatches: Number(row.bot_matches),
        configId: row.config_id ?? "(unbound)",
        matches: Number(row.matches)
      }));
      return {
        dimension: filter.dimension,
        domain: DOMAIN,
        notice: "battle_config_link_pending",
        page: filter.page,
        pageSize: filter.pageSize,
        rows: out,
        total
      };
    }
    // Default: most recent matches summary (linked to /battle/matches drilldown).
    const matches = await this.prisma.battleSession.findMany({
      orderBy: { startedAt: "desc" },
      select: {
        completedAt: true,
        id: true,
        mode: true,
        opponentScore: true,
        startedAt: true,
        status: true,
        userScore: true
      },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
      where: { startedAt: { gte: r.from, lt: r.to } }
    });
    const total = await this.prisma.battleSession.count({
      where: { startedAt: { gte: r.from, lt: r.to } }
    });
    const rows: AnalyticsBreakdownRow[] = matches.map((m) => ({
      durationMs: m.completedAt ? m.completedAt.getTime() - m.startedAt.getTime() : null,
      id: m.id,
      mode: m.mode,
      opponentScore: m.opponentScore,
      startedAt: m.startedAt.toISOString(),
      status: m.status,
      userScore: m.userScore
    }));
    return {
      dimension: filter.dimension || "matches",
      domain: DOMAIN,
      page: filter.page,
      pageSize: filter.pageSize,
      rows,
      total
    };
  }

  private matchesWhere(_filter: AnalyticsCommonFilter): Prisma.BattleSessionWhereInput {
    // BattleSession does not carry a configId column today; configId filter is recorded in summary().filtersApplied
    // but cannot yet narrow the SQL query (partial_schema_pending).
    return {};
  }

  private configFilterSql(_w: Prisma.BattleSessionWhereInput): Prisma.Sql {
    // Reserved for future extension when config-level filters apply at SQL layer.
    return Prisma.empty;
  }

  private async distinctUsers(from: Date, to: Date, _w: Prisma.BattleSessionWhereInput) {
    const rows = await this.prisma.battleSession.findMany({
      select: { userId: true },
      where: { startedAt: { gte: from, lt: to } }
    });
    return new Set(rows.map((r) => r.userId)).size;
  }

  private async avgMatchDurationMs(
    from: Date,
    to: Date,
    _w: Prisma.BattleSessionWhereInput
  ): Promise<{ avgMs: number; count: number }> {
    const rows = await this.prisma.battleSession.findMany({
      select: { completedAt: true, startedAt: true },
      where: {
        completedAt: { not: null },
        startedAt: { gte: from, lt: to },
        status: "completed"
      }
    });
    if (rows.length === 0) return { avgMs: 0, count: 0 };
    const total = rows.reduce(
      (acc, r) => acc + ((r.completedAt as Date).getTime() - r.startedAt.getTime()),
      0
    );
    return { avgMs: Math.round(total / rows.length), count: rows.length };
  }
}
