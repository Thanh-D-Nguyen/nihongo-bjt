import { createPrismaClient, type Prisma, type PrismaClient } from "@nihongo-bjt/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class AdsAdminService {
  private readonly prisma: PrismaClient = createPrismaClient();

  private isClickKind(kind: string) {
    return kind === "click" || kind === "dismiss";
  }

  private isBlockedKind(kind: string) {
    return kind === "blocked";
  }

  private isImpressionKind(kind: string) {
    return !this.isClickKind(kind) && !this.isBlockedKind(kind);
  }

  async overview(windowDays: number) {
    const end = new Date();
    const now = end;
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - windowDays);
    const prevStart = new Date(start);
    prevStart.setUTCDate(prevStart.getUTCDate() - windowDays);

    const [
      enabledPlacements,
      activeCampaigns,
      providersEnabled,
      policyWarnings,
      impWindow,
      impPrev
    ] = await Promise.all([
      this.prisma.adPlacement.count({ where: { active: true } }),
      this.prisma.adCampaign.count({
        where: {
          AND: [
            { status: "active" },
            { OR: [{ startAt: null }, { startAt: { lte: now } }] },
            { OR: [{ endAt: null }, { endAt: { gte: now } }] }
          ]
        }
      }),
      this.prisma.adProviderConfig.count({ where: { enabled: true } }),
      this.prisma.adCampaign.count({ where: { policyStatus: { in: ["warning", "rejected"] } } }),
      this.prisma.adImpression.findMany({
        select: { kind: true, createdAt: true, placementId: true, decisionKey: true },
        where: { createdAt: { gte: start, lt: end } }
      }),
      this.prisma.adImpression.findMany({
        select: { kind: true },
        where: { createdAt: { gte: prevStart, lt: start } }
      })
    ]);

    const impressions7d = impWindow.filter((r) => this.isImpressionKind(r.kind)).length;
    const clicks7d = impWindow.filter((r) => this.isClickKind(r.kind)).length;
    const blocked7d = impWindow.filter((r) => this.isBlockedKind(r.kind)).length;
    const ctr = impressions7d > 0 ? clicks7d / impressions7d : 0;
    const trend = this.dailyTrend(impWindow, start, end);

    const byPlacement: Record<string, { impressions: number; clicks: number }> = {};
    for (const r of impWindow) {
      const pid = r.placementId;
      if (!byPlacement[pid]) {
        byPlacement[pid] = { clicks: 0, impressions: 0 };
      }
      if (this.isImpressionKind(r.kind)) {
        byPlacement[pid].impressions += 1;
      } else if (this.isClickKind(r.kind)) {
        byPlacement[pid].clicks += 1;
      }
    }
    const placements = await this.prisma.adPlacement.findMany({ select: { id: true, code: true } });
    const ctrByPlacement = placements.map((p) => {
      const s = byPlacement[p.id] ?? { clicks: 0, impressions: 0 };
      return {
        code: p.code,
        ctr: s.impressions > 0 ? s.clicks / s.impressions : 0,
        ...s
      };
    });
    const blockedByReason: Record<string, number> = {};
    for (const r of impWindow) {
      if (this.isBlockedKind(r.kind) && r.decisionKey) {
        blockedByReason[r.decisionKey] = (blockedByReason[r.decisionKey] ?? 0) + 1;
      }
    }

    return {
      activeCampaigns,
      blocked7d,
      blockedByReason: Object.entries(blockedByReason).map(([reason, count]) => ({ count, reason })),
      chartCtrByPlacement: ctrByPlacement,
      chartTrend: trend,
      clicks7d,
      ctr,
      enabledPlacements,
      impressions7d,
      policyWarnings,
      previousWindow: { clicks: this.countClicks(impPrev), impressions: this.countImpressions(impPrev) },
      providersEnabled,
      revenue: { available: false, messageKey: "revenue_provider_not_connected" as const }
    };
  }

  private countImpressions(rows: { kind: string }[]) {
    return rows.filter((r) => this.isImpressionKind(r.kind)).length;
  }
  private countClicks(rows: { kind: string }[]) {
    return rows.filter((r) => this.isClickKind(r.kind)).length;
  }

  private dailyTrend(
    rows: { createdAt: Date; kind: string }[],
    start: Date,
    end: Date
  ) {
    const byDay: Record<string, { clicks: number; impressions: number }> = {};
    const d = new Date(start);
    while (d < end) {
      const k = d.toISOString().slice(0, 10);
      byDay[k] = { clicks: 0, impressions: 0 };
      d.setUTCDate(d.getUTCDate() + 1);
    }
    for (const r of rows) {
      const k = r.createdAt.toISOString().slice(0, 10);
      if (!byDay[k]) {
        continue;
      }
      if (this.isImpressionKind(r.kind)) {
        byDay[k].impressions += 1;
      } else if (this.isClickKind(r.kind)) {
        byDay[k].clicks += 1;
      }
    }
    return Object.entries(byDay).map(([day, v]) => ({ ...v, day }));
  }

  async tasks() {
    const now = new Date();
    const in7d = new Date(now);
    in7d.setUTCDate(in7d.getUTCDate() + 7);
    const providers = await this.prisma.adProviderConfig.findMany();
    const disabledProviders = providers.filter((p) => !p.enabled);
    const placements = await this.prisma.adPlacement.findMany();
    const campaigns = await this.prisma.adCampaign.findMany();
    const endingSoon = campaigns.filter(
      (c) => c.endAt && c.endAt > now && c.endAt < in7d && c.status === "active"
    );
    const noProvider: string[] = [];
    for (const pl of placements) {
      const cfg = (pl.config as Record<string, unknown>)?.providerKey;
      if (typeof cfg !== "string" || !cfg) {
        const hasLocal = providers.some((x) => x.key === "local" && x.enabled);
        if (!hasLocal) {
          noProvider.push(pl.code);
        }
      }
    }
    return {
      campaignsEndingSoon: endingSoon,
      disabledProviders,
      placementsWithoutProvider: noProvider,
      policyWarnings: await this.prisma.adCampaign.findMany({ where: { policyStatus: "warning" }, take: 20 })
    };
  }

  async listPlacements() {
    const rows = await this.prisma.adPlacement.findMany({ orderBy: { code: "asc" } });
    const statRows = await this.prisma.adImpression.groupBy({ by: ["placementId", "kind"], _count: { _all: true } });
    const byPlace = new Map<string, { clicks: number; impressions: number }>();
    for (const s of statRows) {
      const cur = byPlace.get(s.placementId) ?? { clicks: 0, impressions: 0 };
      if (this.isClickKind(s.kind)) {
        cur.clicks += s._count._all;
      } else if (!this.isBlockedKind(s.kind)) {
        cur.impressions += s._count._all;
      }
      byPlace.set(s.placementId, cur);
    }
    const allCampaigns = await this.prisma.adCampaign.findMany();
    return rows.map((p) => {
      const s = byPlace.get(p.id) ?? { clicks: 0, impressions: 0 };
      const ctr = s.impressions > 0 ? s.clicks / s.impressions : 0;
      const codes = allCampaigns.filter((c) => (c.placementCodes as string[]).includes(p.code));
      const config = p.config as Record<string, unknown>;
      return {
        ...p,
        campaignCount: codes.length,
        config,
        ctr,
        learningSafe: config.learningSafe !== false,
        stats: s
      };
    });
  }

  async createPlacement(data: {
    active: boolean;
    code: string;
    config: Prisma.InputJsonValue;
    labelKey?: string | null;
  }) {
    return this.prisma.adPlacement.create({
      data: {
        active: data.active,
        code: data.code,
        config: data.config,
        labelKey: data.labelKey ?? null
      }
    });
  }

  async updatePlacement(
    id: string,
    data: { active?: boolean; code?: string; config?: Prisma.InputJsonValue; labelKey?: string | null }
  ) {
    return this.prisma.adPlacement.update({ data, where: { id } });
  }

  async listCampaigns() {
    return this.prisma.adCampaign.findMany({ orderBy: [{ priority: "desc" }, { updatedAt: "desc" }] });
  }

  async createCampaign(data: {
    name: string;
    status: string;
    providerKey: string;
    placementCodes: string[];
    startAt: Date | null;
    endAt: Date | null;
    priority: number;
    creativeType: string;
    destinationUrl: string | null;
    targetLocale: string | null;
    targetPlanSlug: string | null;
    maxImpressions: number | null;
    policyStatus: string;
  }) {
    return this.prisma.adCampaign.create({
      data: {
        creativeType: data.creativeType,
        destinationUrl: data.destinationUrl,
        endAt: data.endAt,
        maxImpressions: data.maxImpressions,
        name: data.name,
        placementCodes: data.placementCodes,
        policyStatus: data.policyStatus,
        priority: data.priority,
        providerKey: data.providerKey,
        startAt: data.startAt,
        status: data.status,
        targetLocale: data.targetLocale,
        targetPlanSlug: data.targetPlanSlug
      }
    });
  }

  async updateCampaign(id: string, data: Prisma.AdCampaignUpdateInput) {
    return this.prisma.adCampaign.update({ data, where: { id } });
  }

  async listProviders() {
    return this.prisma.adProviderConfig.findMany({ orderBy: { key: "asc" } });
  }

  async upsertProvider(
    key: string,
    data: {
      config?: Prisma.InputJsonValue;
      enabled?: boolean;
      lastSyncAt?: Date | null;
      status?: string;
      type: string;
    }
  ) {
    return this.prisma.adProviderConfig.upsert({
      create: {
        config: (data.config ?? {}) as Prisma.InputJsonValue,
        enabled: data.enabled ?? true,
        key,
        lastSyncAt: data.lastSyncAt,
        status: data.status ?? "ok",
        type: data.type
      },
      update: {
        config: data.config,
        enabled: data.enabled,
        lastSyncAt: data.lastSyncAt,
        status: data.status
      },
      where: { key }
    });
  }

  async listRules() {
    return this.prisma.adSafetyRule.findMany({ orderBy: { ruleKey: "asc" } });
  }

  async upsertRule(ruleKey: string, data: { config?: Prisma.InputJsonValue; enabled?: boolean }) {
    return this.prisma.adSafetyRule.upsert({
      create: { config: (data.config ?? {}) as Prisma.InputJsonValue, enabled: data.enabled ?? true, ruleKey },
      update: { config: data.config, enabled: data.enabled },
      where: { ruleKey }
    });
  }

  async performance(params: { windowDays: number }) {
    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - params.windowDays);
    const rows = await this.prisma.adImpression.findMany({
      where: { createdAt: { gte: start, lt: end } }
    });
    const placements = await this.prisma.adPlacement.findMany();
    const pMap = new Map(placements.map((p) => [p.id, p.code]));
    const byPlacement: Record<string, { blocked: number; clicks: number; impressions: number }> = {};
    const byCampaign: Record<string, { blocked: number; clicks: number; impressions: number }> = {};
    const byLocale: Record<string, { clicks: number; impressions: number }> = {};
    const byPlan: Record<string, { clicks: number; impressions: number }> = {};
    const byDevice: Record<string, { clicks: number; impressions: number }> = {};
    for (const r of rows) {
      const pk = pMap.get(r.placementId) ?? r.placementId;
      if (!byPlacement[pk]) {
        byPlacement[pk] = { blocked: 0, clicks: 0, impressions: 0 };
      }
      if (this.isImpressionKind(r.kind)) {
        byPlacement[pk].impressions += 1;
      } else if (this.isClickKind(r.kind)) {
        byPlacement[pk].clicks += 1;
      } else if (this.isBlockedKind(r.kind)) {
        byPlacement[pk].blocked += 1;
      }
      if (r.campaignId) {
        const c = r.campaignId;
        if (!byCampaign[c]) {
          byCampaign[c] = { blocked: 0, clicks: 0, impressions: 0 };
        }
        if (this.isImpressionKind(r.kind)) {
          byCampaign[c].impressions += 1;
        } else if (this.isClickKind(r.kind)) {
          byCampaign[c].clicks += 1;
        } else if (this.isBlockedKind(r.kind)) {
          byCampaign[c].blocked += 1;
        }
      }
      const ctx = (r.clientContext ?? null) as {
        device?: string;
        locale?: string;
        planSlug?: string;
      } | null;
      const loc = ctx?.locale ?? "unknown";
      if (!byLocale[loc]) {
        byLocale[loc] = { clicks: 0, impressions: 0 };
      }
      if (this.isImpressionKind(r.kind)) {
        byLocale[loc].impressions += 1;
      } else if (this.isClickKind(r.kind)) {
        byLocale[loc].clicks += 1;
      }
      const planKey = ctx?.planSlug ?? "unknown";
      if (!byPlan[planKey]) {
        byPlan[planKey] = { clicks: 0, impressions: 0 };
      }
      if (this.isImpressionKind(r.kind)) {
        byPlan[planKey].impressions += 1;
      } else if (this.isClickKind(r.kind)) {
        byPlan[planKey].clicks += 1;
      }
      const devKey = ctx?.device ?? "unknown";
      if (!byDevice[devKey]) {
        byDevice[devKey] = { clicks: 0, impressions: 0 };
      }
      if (this.isImpressionKind(r.kind)) {
        byDevice[devKey].impressions += 1;
      } else if (this.isClickKind(r.kind)) {
        byDevice[devKey].clicks += 1;
      }
    }
    const totImp = rows.filter((r) => this.isImpressionKind(r.kind)).length;
    const totClk = rows.filter((r) => this.isClickKind(r.kind)).length;
    return {
      byCampaign: Object.entries(byCampaign).map(([id, v]) => ({ id, ...v, ctr: v.impressions > 0 ? v.clicks / v.impressions : 0 })),
      byDevice: Object.entries(byDevice).map(([device, v]) => ({
        ...v,
        ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
        device
      })),
      byLocale: Object.entries(byLocale).map(([locale, v]) => ({ ...v, ctr: v.impressions > 0 ? v.clicks / v.impressions : 0, locale })),
      byPlan: Object.entries(byPlan).map(([planSlug, v]) => ({
        ...v,
        ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
        planSlug
      })),
      byPlacement: Object.entries(byPlacement).map(([code, v]) => ({
        code,
        ...v,
        ctr: v.impressions > 0 ? v.clicks / v.impressions : 0
      })),
      fillRate: null as number | null,
      revenue: { available: false, messageKey: "revenue_provider_not_connected" as const },
      totals: {
        blocked: rows.filter((r) => this.isBlockedKind(r.kind)).length,
        clicks: totClk,
        ctr: totImp > 0 ? totClk / totImp : 0,
        impressions: totImp
      },
      windowDays: params.windowDays
    };
  }

  async auditLog(take: number) {
    return this.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take,
      where: {
        OR: [
          { action: { startsWith: "ads." } },
          { action: { contains: "ad_placement" } },
          { action: { contains: "ad_campaign" } },
          { action: { contains: "ad_provider" } },
          { action: { contains: "ad_safety" } }
        ]
      }
    });
  }
}
