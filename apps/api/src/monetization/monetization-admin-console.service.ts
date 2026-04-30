import { createPrismaClient, type Prisma, type PrismaClient } from "@nihongo-bjt/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class MonetizationAdminConsoleService {
  private readonly prisma: PrismaClient = createPrismaClient();

  async overview() {
    const [totalUsers, activeTrialingSubs, pastDueSubs, adPlacementsActive, subscribStats, freePlan] =
      await Promise.all([
        this.prisma.userProfile.count(),
        this.prisma.userSubscription.count({ where: { status: { in: ["active", "trialing"] } } }),
        this.prisma.userSubscription.count({ where: { status: "past_due" } }),
        this.prisma.adPlacement.count({ where: { active: true } }),
        this.prisma.userSubscription.groupBy({
          by: ["status"],
          _count: { _all: true }
        }),
        this.prisma.plan.findFirst({ where: { slug: "free" } })
      ]);

    const freePlanId = freePlan?.id;
    const paidActiveCount = freePlanId
      ? await this.prisma.userSubscription.count({
          where: {
            status: { in: ["active", "trialing"] },
            planId: { not: freePlanId }
          }
        })
      : 0;
    const freeActiveCount = freePlanId
      ? await this.prisma.userSubscription.count({
          where: {
            status: { in: ["active", "trialing"] },
            planId: freePlanId
          }
        })
      : 0;

    const byPlan = await this.prisma.userSubscription.groupBy({
      by: ["planId", "status"],
      _count: { _all: true }
    });
    const planSlugs = await this.prisma.plan.findMany({ select: { id: true, slug: true } });
    const slugById = new Map(planSlugs.map((p) => [p.id, p.slug] as const));
    const planDistribution = byPlan.map((row) => ({
      count: row._count._all,
      planSlug: slugById.get(row.planId) ?? row.planId,
      status: row.status
    }));

    const plansMissingEntitlements = await this.prisma.plan.findMany({
      include: { _count: { select: { entitlements: true } } },
      where: { entitlements: { none: {} } }
    });
    const disabledAdPlacements = await this.prisma.adPlacement.count({ where: { active: false } });

    const paywallViews = await this.prisma.analyticsEvent.count({
      where: { eventName: "monetization_paywall_view" }
    });
    const checkouts = await this.prisma.analyticsEvent.count({
      where: { eventName: "monetization_checkout_session" }
    });

    const last14 = new Date();
    last14.setDate(last14.getDate() - 14);
    const subscriptionTrend = await this.prisma.$queryRaw<
      { day: string; count: bigint }[]
    >`select date_trunc('day', created_at) as day, count(*)::bigint as count
      from monetization.user_subscription
      where created_at >= ${last14}
      group by 1
      order by 1 asc`;

    const trialing = subscribStats.find((s) => s.status === "trialing")?._count._all ?? 0;
    const convDenom = paidActiveCount + freeActiveCount;
    const conversionRate = convDenom > 0 ? (paidActiveCount / convDenom) * 100 : 0;

    return {
      kpis: {
        totalUsers,
        freeUsersActiveOnFreePlan: freeActiveCount,
        paidUsersActive: paidActiveCount,
        trialUsers: trialing,
        conversionRatePercent: Math.round(conversionRate * 100) / 100,
        activeSubscriptions: activeTrialingSubs,
        pastDueSubscriptions: pastDueSubs,
        quotaWarningUsers: null as number | null,
        adsEnabledPlacements: adPlacementsActive
      },
      charts: {
        planDistribution,
        subscriptionTrend: subscriptionTrend.map((r) => ({
          day: r.day,
          count: Number(r.count)
        })),
        paywallFunnel: { paywallViews, checkoutSessions: checkouts }
      },
      tasks: {
        plansMissingEntitlementCount: plansMissingEntitlements.length,
        plansMissingEntitlementIds: plansMissingEntitlements.map((p) => p.id),
        quotasNearExhaustionAvailable: false,
        failedBillingSyncAvailable: false,
        disabledAdPlacements
      },
      dataNotes: {
        quotaPressureNeedsRollup: true
      }
    };
  }

  async plansWithStats() {
    const plans = await this.prisma.plan.findMany({
      include: {
        _count: { select: { entitlements: true, planQuotas: true, subscriptions: true } },
        entitlements: { include: { entitlement: true } },
        planQuotas: { include: { quotaPolicy: true } }
      },
      orderBy: { sortOrder: "asc" }
    });
    return plans;
  }

  async entitlementsCatalog() {
    return this.prisma.entitlementDefinition.findMany({
      include: {
        _count: { select: { plans: true } }
      },
      orderBy: { key: "asc" }
    });
  }

  async quotaPolicies() {
    const [policies, planQuotas] = await Promise.all([
      this.prisma.quotaPolicy.findMany({ orderBy: { key: "asc" } }),
      this.prisma.planQuota.findMany({
        include: { plan: { select: { id: true, slug: true } }, quotaPolicy: true }
      })
    ]);
    return { planQuotas, policies };
  }

  async subscriptionsList(params: { limit: number; offset: number; q?: string; status?: string }) {
    const where: Prisma.UserSubscriptionWhereInput = {};
    if (params.status) {
      where.status = params.status;
    }
    if (params.q) {
      const u = await this.prisma.userProfile.findMany({
        select: { id: true },
        take: 200,
        where: {
          OR: [
            { email: { contains: params.q, mode: "insensitive" } },
            { displayName: { contains: params.q, mode: "insensitive" } }
          ]
        }
      });
      where.userId = { in: u.map((x) => x.id) };
    }
    const [rows, total] = await Promise.all([
      this.prisma.userSubscription.findMany({
        include: { plan: { select: { nameKey: true, slug: true } }, user: { select: { email: true, displayName: true, id: true } } },
        orderBy: { updatedAt: "desc" },
        skip: params.offset,
        take: params.limit,
        where
      }),
      this.prisma.userSubscription.count({ where })
    ]);
    return { items: rows, total };
  }

  async quotaOverrides() {
    return this.prisma.quotaUserOverride.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { email: true, displayName: true, id: true } } }
    });
  }

  async coupons() {
    return this.prisma.promotionCoupon.findMany({ orderBy: { updatedAt: "desc" } });
  }

  async adPlacements() {
    const rows = await this.prisma.adPlacement.findMany({ orderBy: { code: "asc" } });
    const statRows = await this.prisma.adImpression.groupBy({
      by: ["placementId", "kind"],
      _count: { _all: true }
    });
    const byPlace = new Map<string, { impressions: number; clicks: number }>();
    for (const s of statRows) {
      const cur = byPlace.get(s.placementId) ?? { clicks: 0, impressions: 0 };
      if (s.kind === "click" || s.kind === "dismiss") {
        cur.clicks += s._count._all;
      } else {
        cur.impressions += s._count._all;
      }
      byPlace.set(s.placementId, cur);
    }
    return rows.map((p) => {
      const s = byPlace.get(p.id) ?? { clicks: 0, impressions: 0 };
      const ctr = s.impressions > 0 ? s.clicks / s.impressions : 0;
      return { ...p, ctr, impressions: s.impressions, clicks: s.clicks };
    });
  }

  async monetizationAnalytics() {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const byName = await this.prisma.analyticsEvent.groupBy({
      by: ["eventName"],
      _count: { _all: true },
      where: { createdAt: { gte: since }, eventName: { startsWith: "monetization_" } }
    });
    return {
      billingProviderConnected: true,
      windowDays: 30,
      eventsByName: byName.map((r) => ({ count: r._count._all, name: r.eventName })),
      revenuePlaceholder: null
    };
  }

  async createPlan(input: {
    slug: string;
    nameKey: string;
    status: string;
    config: Prisma.InputJsonValue;
  }) {
    return this.prisma.plan.create({
      data: {
        config: input.config,
        nameKey: input.nameKey,
        slug: input.slug,
        status: input.status
      }
    });
  }

  async updatePlanRow(
    id: string,
    data: { config?: Prisma.InputJsonValue; nameKey?: string; sortOrder?: number; status?: string }
  ) {
    return this.prisma.plan.update({ data, where: { id } });
  }

  async createEntitlement(input: { category: string | null; description: string | null; key: string }) {
    return this.prisma.entitlementDefinition.create({ data: input });
  }

  async linkPlanEntitlement(planId: string, entitlementId: string) {
    return this.prisma.planEntitlement.create({
      data: { entitlementId, planId }
    });
  }

  async unlinkPlanEntitlement(planId: string, entitlementId: string) {
    return this.prisma.planEntitlement.delete({
      where: { planId_entitlementId: { entitlementId, planId } }
    });
  }

  async createQuotaPolicy(input: {
    description: string | null;
    key: string;
    warnThresholdPercent: number | null;
    windowCode: string;
  }) {
    return this.prisma.quotaPolicy.create({ data: input });
  }

  async updateQuotaPolicy(
    id: string,
    data: { description?: string | null; warnThresholdPercent?: number | null; windowCode?: string }
  ) {
    return this.prisma.quotaPolicy.update({ data, where: { id } });
  }

  async linkPlanQuota(planId: string, quotaPolicyId: string, limitValue: number) {
    return this.prisma.planQuota.create({ data: { limitValue, planId, quotaPolicyId } });
  }

  async createQuotaOverride(input: {
    createdByActorId: string;
    expiresAt: Date | null;
    limitValue: number;
    quotaKey: string;
    reason: string;
    userId: string;
  }) {
    return this.prisma.quotaUserOverride.create({ data: input });
  }

  async deleteQuotaOverride(id: string) {
    return this.prisma.quotaUserOverride.delete({ where: { id } });
  }

  async updateSubscription(
    id: string,
    data: {
      cancelAtPeriodEnd?: boolean;
      currentPeriodEnd?: Date | null;
      planId?: string;
      status?: string;
      trialEnd?: Date | null;
    }
  ) {
    return this.prisma.userSubscription.update({ data, where: { id } });
  }

  async createCoupon(input: {
    allowedPlanSlugs: unknown;
    code: string;
    discountType: string;
    discountValue: number;
    endsAt: Date | null;
    maxRedemptions: number | null;
    startsAt: Date | null;
    status: string;
  }) {
    return this.prisma.promotionCoupon.create({
      data: { ...input, allowedPlanSlugs: input.allowedPlanSlugs as Prisma.InputJsonValue }
    });
  }

  async updateCoupon(
    id: string,
    data: {
      allowedPlanSlugs?: Prisma.InputJsonValue;
      discountType?: string;
      discountValue?: number;
      endsAt?: Date | null;
      maxRedemptions?: number | null;
      startsAt?: Date | null;
      status?: string;
    }
  ) {
    return this.prisma.promotionCoupon.update({ data, where: { id } });
  }

  async updateAdPlacement(id: string, data: { active?: boolean; config?: Prisma.InputJsonValue }) {
    return this.prisma.adPlacement.update({ data, where: { id } });
  }

  async auditFeed(params: { action?: string; from?: string; to?: string; take: number }) {
    const from = params.from ? new Date(params.from) : undefined;
    const to = params.to ? new Date(params.to) : undefined;
    const dateFilter =
      from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {};
    const [adminRows, mRows] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: params.take,
        where: {
          ...dateFilter,
          ...(params.action ? { action: { contains: params.action, mode: "insensitive" } } : {}),
          OR: [
            { targetType: { contains: "monetization" } },
            { action: { contains: "monetization" } },
            { action: { contains: "billing" } }
          ]
        }
      }),
      this.prisma.monetizationAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: params.take,
        where: dateFilter
      })
    ]);
    const merged = [
      ...adminRows.map((r) => ({
        action: r.action,
        actorId: r.actorId,
        at: r.createdAt.toISOString(),
        id: r.id,
        source: "ops.admin_audit" as const,
        targetId: r.targetId,
        targetType: r.targetType
      })),
      ...mRows.map((r) => ({
        action: r.action,
        actorKind: r.actorKind,
        at: r.createdAt.toISOString(),
        id: r.id,
        payload: r.payload,
        source: "monetization.audit" as const,
        userId: r.userId
      }))
    ]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, params.take);
    return { items: merged };
  }
}
