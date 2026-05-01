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

const DOMAIN = "growth";

export type GrowthAnalyticsSummary = {
  domain: typeof DOMAIN;
  range: { from: string; to: string; days: number };
  filtersApplied: { source: boolean; campaign: boolean; locale: boolean };
  kpis: AnalyticsKpi[];
  freshness: { lastRollupAt: string | null; status: string | null; sourceTable: string };
};

@Injectable()
export class AnalyticsGrowthAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async summary(filter: AnalyticsCommonFilter): Promise<GrowthAnalyticsSummary> {
    const r = resolveAnalyticsRange(filter);
    const profileWhere = this.profileWhere(filter);
    const [signups, signupsPrev, activated, activatedPrev, paid, paidPrev, referral, referralPrev, shares, sharesPrev, latestRun] =
      await Promise.all([
        this.prisma.userProfile.count({ where: { ...profileWhere, createdAt: { gte: r.from, lt: r.to } } }),
        this.prisma.userProfile.count({
          where: { ...profileWhere, createdAt: { gte: r.previousFrom, lt: r.previousTo } }
        }),
        this.activatedCount(r.from, r.to, profileWhere),
        this.activatedCount(r.previousFrom, r.previousTo, profileWhere),
        this.paidConversionCount(r.from, r.to, profileWhere),
        this.paidConversionCount(r.previousFrom, r.previousTo, profileWhere),
        this.prisma.referralEvent.count({ where: { createdAt: { gte: r.from, lt: r.to } } }),
        this.prisma.referralEvent.count({
          where: { createdAt: { gte: r.previousFrom, lt: r.previousTo } }
        }),
        this.prisma.shareItem.count({ where: { createdAt: { gte: r.from, lt: r.to } } }),
        this.prisma.shareItem.count({
          where: { createdAt: { gte: r.previousFrom, lt: r.previousTo } }
        }),
        this.prisma.analyticsRollupRun.findFirst({ orderBy: { startedAt: "desc" } })
      ]);

    const activationRate = signups > 0 ? activated / signups : null;
    const activationRatePrev = signupsPrev > 0 ? activatedPrev / signupsPrev : null;
    const paidRate = signups > 0 ? paid / signups : null;
    const paidRatePrev = signupsPrev > 0 ? paidPrev / signupsPrev : null;
    const shareRate = signups > 0 ? shares / signups : null;
    const shareRatePrev = signupsPrev > 0 ? sharesPrev / signupsPrev : null;

    return {
      domain: DOMAIN,
      filtersApplied: {
        campaign: Boolean(filter.campaign),
        locale: Boolean(filter.locale),
        source: Boolean(filter.source)
      },
      freshness: {
        lastRollupAt: latestRun?.completedAt?.toISOString() ?? null,
        sourceTable: "profile.user_profile",
        status: latestRun?.status ?? null
      },
      kpis: [
        buildKpi({ format: "int", id: "signups", previous: signupsPrev, value: signups }),
        buildKpi({
          available: signups > 0,
          format: "percent",
          id: "activationRate",
          previous: activationRatePrev,
          unavailableCode: signups === 0 ? "no_signups_in_range" : undefined,
          value: activationRate
        }),
        buildKpi({
          available: signups > 0,
          format: "percent",
          id: "paidConversionRate",
          previous: paidRatePrev,
          unavailableCode: signups === 0 ? "no_signups_in_range" : undefined,
          value: paidRate
        }),
        buildKpi({ format: "int", id: "referralEvents", previous: referralPrev, value: referral }),
        buildKpi({
          available: signups > 0,
          format: "percent",
          id: "shareRate",
          previous: shareRatePrev,
          unavailableCode: signups === 0 ? "no_signups_in_range" : undefined,
          value: shareRate
        }),
        buildKpi({ format: "int", id: "shareItems", previous: sharesPrev, value: shares })
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
    const where = this.profileWhere(filter);
    if (filter.metric === "signups") {
      const rows = await this.prisma.userProfile.findMany({
        select: { createdAt: true },
        where: { ...where, createdAt: { gte: r.from, lt: r.to } }
      });
      const m = new Map<string, number>();
      for (const row of rows) {
        const k = row.createdAt.toISOString().slice(0, 10);
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
    if (filter.metric === "share_events") {
      const rows = await this.prisma.shareItem.findMany({
        select: { createdAt: true },
        where: { createdAt: { gte: r.from, lt: r.to } }
      });
      const m = new Map<string, number>();
      for (const row of rows) {
        const k = row.createdAt.toISOString().slice(0, 10);
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
    if (filter.metric === "referral_events") {
      const rows = await this.prisma.referralEvent.findMany({
        select: { createdAt: true },
        where: { createdAt: { gte: r.from, lt: r.to } }
      });
      const m = new Map<string, number>();
      for (const row of rows) {
        const k = row.createdAt.toISOString().slice(0, 10);
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
    if (filter.dimension === "by_referral_kind") {
      const rows = await this.prisma.referralEvent.groupBy({
        _count: { _all: true },
        by: ["kind"],
        where: { createdAt: { gte: r.from, lt: r.to } }
      });
      const out: AnalyticsBreakdownRow[] = rows.map((r0) => ({ count: r0._count._all, kind: r0.kind }));
      return {
        dimension: filter.dimension,
        domain: DOMAIN,
        page: 1,
        pageSize: out.length,
        rows: out,
        total: out.length
      };
    }
    if (filter.dimension === "by_share_kind") {
      const rows = await this.prisma.shareItem.groupBy({
        _count: { _all: true },
        by: ["kind"],
        where: { createdAt: { gte: r.from, lt: r.to } }
      });
      const out: AnalyticsBreakdownRow[] = rows.map((r0) => ({ count: r0._count._all, kind: r0.kind }));
      return {
        dimension: filter.dimension,
        domain: DOMAIN,
        page: 1,
        pageSize: out.length,
        rows: out,
        total: out.length
      };
    }
    // by_campaign
    const list = await this.prisma.growthCampaign.findMany({
      orderBy: { updatedAt: "desc" },
      select: { channel: true, id: true, name: true, status: true, updatedAt: true },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize
    });
    const total = await this.prisma.growthCampaign.count();
    const out: AnalyticsBreakdownRow[] = list.map((c) => ({
      campaignId: c.id,
      channel: c.channel,
      name: c.name,
      status: c.status,
      updatedAt: c.updatedAt.toISOString()
    }));
    return {
      dimension: filter.dimension || "by_campaign",
      domain: DOMAIN,
      page: filter.page,
      pageSize: filter.pageSize,
      rows: out,
      total
    };
  }

  private profileWhere(filter: AnalyticsCommonFilter): Prisma.UserProfileWhereInput {
    const where: Prisma.UserProfileWhereInput = { status: "active" };
    if (filter.locale && filter.locale !== "all") where.uiLocale = filter.locale;
    return where;
  }

  private async activatedCount(from: Date, to: Date, _w: Prisma.UserProfileWhereInput): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ c: bigint }[]>`
      select count(*)::bigint as c
      from profile.user_profile p
      where p.status = 'active'
        and p.created_at >= ${from} and p.created_at < ${to}
        and exists (
          select 1 from learning.review_event r
          where r.user_id = p.id
            and r.reviewed_at <= p.created_at + interval '24 hour'
        )
    `.catch(() => [{ c: 0n } as { c: bigint }]);
    return Number(rows[0]?.c ?? 0n);
  }

  private async paidConversionCount(from: Date, to: Date, _w: Prisma.UserProfileWhereInput): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ c: bigint }[]>`
      select count(distinct s.user_id)::bigint as c
      from monetization.user_subscription s
      join monetization.plan pl on pl.id = s.plan_id
      join profile.user_profile p on p.id = s.user_id
      where p.created_at >= ${from} and p.created_at < ${to}
        and pl.slug <> 'free'
        and s.status in ('active','trialing')
    `.catch(() => [{ c: 0n } as { c: bigint }]);
    return Number(rows[0]?.c ?? 0n);
  }
}
