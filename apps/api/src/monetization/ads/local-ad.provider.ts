import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { EntitlementKey } from "../monetization.constants.js";
import { EntitlementService } from "../entitlement.service.js";
import type { AdDecideInput, AdDecision, AdProvider } from "./ad-provider.js";

const IMPRESSION_KIND = "impression";
const ANONYMOUS_PLAN_SLUG = "free";

export function isPersonalizedAdConfig(
  placementConfig: Record<string, unknown>,
  providerConfig: unknown
): boolean {
  const provider = (providerConfig ?? {}) as Record<string, unknown>;
  return placementConfig.personalized === true || provider.personalized === true;
}

@Injectable()
export class LocalAdProvider implements AdProvider {
  private readonly prisma: PrismaClient = createPrismaClient();

  constructor(@Inject(EntitlementService) private readonly entitlements: EntitlementService) {}

  async decide(input: AdDecideInput): Promise<AdDecision> {
    const placement = await this.prisma.adPlacement.findFirst({
      where: { active: true, code: input.placementCode }
    });
    if (!placement) {
      throw new NotFoundException("Ad placement not found");
    }

    const resolved = input.userId
      ? await this.entitlements.listEntitlementKeysForUser(input.userId)
      : null;
    const suppressionKey = resolved?.entitlements.includes(EntitlementKey.ads_remove)
      ? "local:ads_remove"
      : resolved?.entitlements.includes(EntitlementKey.ads_reduced)
        ? "local:ads_reduced"
        : null;
    if (suppressionKey) {
      await this.recordBlocked({
        decisionKey: suppressionKey,
        placementId: placement.id,
        userId: input.userId
      });
      return { decisionKey: suppressionKey, eligible: false };
    }

    // Client plan hints are intentionally ignored. Authenticated plans come from
    // centralized entitlements; anonymous viewers always use the free audience.
    const effectivePlan = resolved?.planSlug ?? ANONYMOUS_PLAN_SLUG;

    const blockReason = await this.evaluateSafetyBlocks(input);
    if (blockReason) {
      await this.recordBlocked({
        decisionKey: blockReason,
        placementId: placement.id,
        userId: input.userId
      });
      return { decisionKey: blockReason, eligible: false };
    }

    const placementCfg = placement.config as Record<string, unknown>;
    if (!this.isPlanAllowed(effectivePlan, placementCfg)) {
      await this.recordBlocked({
        decisionKey: "placement:plan_not_allowed",
        placementId: placement.id,
        userId: input.userId
      });
      return { decisionKey: "placement:plan_not_allowed", eligible: false };
    }

    const maxPerDay = typeof placementCfg.maxPerDay === "number" ? placementCfg.maxPerDay : null;
    if (input.userId && maxPerDay != null && maxPerDay >= 0) {
      const over = await this.overDailyImpressionCap(input.userId, placement.id, maxPerDay);
      if (over) {
        await this.recordBlocked({
          decisionKey: "cap:per_day",
          placementId: placement.id,
          userId: input.userId
        });
        return { decisionKey: "cap:per_day", eligible: false };
      }
    }

    const providerKey = this.getProviderKeyFromPlacement(placement.config);
    const provider = await this.prisma.adProviderConfig.findFirst({
      where: { enabled: true, key: providerKey }
    });
    if (!provider) {
      return this.placeholderDecision({
        decisionKey: "local:provider_placeholder",
        input,
        placement,
        providerKey,
        providerType: "placeholder"
      });
    }

    const campaign = await this.pickCampaign({
      locale: input.locale,
      placementCode: placement.code,
      planSlug: effectivePlan
    });
    if (!campaign) {
      return this.placeholderDecision({
        decisionKey: "local:no_active_campaign",
        input,
        placement,
        providerKey,
        providerType: provider.type
      });
    }

    if (isPersonalizedAdConfig(placementCfg, provider.config)) {
      const profile = input.userId
        ? await this.prisma.userProfile.findUnique({
            select: { adsPersonalizationOptIn: true },
            where: { id: input.userId }
          })
        : null;
      if (!(profile?.adsPersonalizationOptIn ?? false)) {
        await this.recordBlocked({
          decisionKey: "privacy:personalization_opt_in_required",
          placementId: placement.id,
          userId: input.userId
        });
        return { decisionKey: "privacy:personalization_opt_in_required", eligible: false };
      }
    }

    if (campaign.maxImpressions != null) {
      const n = await this.prisma.adImpression.count({
        where: { campaignId: campaign.id, kind: { in: [IMPRESSION_KIND, "view", "serve"] } }
      });
      if (n >= campaign.maxImpressions) {
        await this.recordBlocked({
          decisionKey: "campaign:max_impressions",
          placementId: placement.id,
          userId: input.userId
        });
        return { decisionKey: "campaign:max_impressions", eligible: false };
      }
    }

    return {
      campaignId: campaign.id,
      decisionKey: "local:default",
      eligible: true,
      payload: {
        campaign: {
          creativeType: campaign.creativeType,
          destinationUrl: campaign.destinationUrl,
          id: campaign.id,
          name: campaign.name
        },
        config: placement.config,
        labelKey: placement.labelKey,
        providerKey,
        providerType: provider.type
      }
    };
  }

  private getProviderKeyFromPlacement(config: unknown): string {
    const c = (config ?? {}) as Record<string, unknown>;
    const k = c.providerKey;
    return typeof k === "string" && k ? k : "local";
  }

  private placeholderDecision(input: {
    decisionKey: string;
    input: AdDecideInput;
    placement: { code: string; config: unknown; labelKey: string | null };
    providerKey: string;
    providerType: string;
  }): AdDecision {
    return {
      decisionKey: input.decisionKey,
      eligible: false
    };
  }

  private isPlanAllowed(planSlug: string, placementCfg: Record<string, unknown>): boolean {
    const allowed = placementCfg.allowedPlanSlugs ?? placementCfg.allowedPlans;
    if (!Array.isArray(allowed) || allowed.length === 0) {
      return true;
    }
    return allowed.some((p) => typeof p === "string" && p === planSlug);
  }

  private async evaluateSafetyBlocks(input: AdDecideInput): Promise<string | null> {
    const sk = input.learningContext?.sessionKind ?? "default";
    if (sk === "default") {
      return null;
    }

    const blockRow = await this.prisma.adSafetyRule.findFirst({
      where: { enabled: true, ruleKey: "learning_session_blocks" }
    });
    const fromCfg = (blockRow?.config as { sessionKinds?: string[] } | null)?.sessionKinds;
    const blockedKinds: string[] = blockRow
      ? (fromCfg ?? ["flashcard_review", "bjt_timed", "quiz_active"])
      : ["flashcard_review", "bjt_timed", "quiz_active"];
    if (blockedKinds.length === 0) {
      return null;
    }
    if (blockedKinds.includes(sk)) {
      return `safety:learning_session:${sk}`;
    }
    return null;
  }

  private async overDailyImpressionCap(userId: string, placementId: string, max: number) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const c = await this.prisma.adImpression.count({
      where: {
        createdAt: { gte: start },
        kind: { in: [IMPRESSION_KIND, "view", "serve"] },
        placementId,
        userId
      }
    });
    return c >= max;
  }

  private async pickCampaign(input: { locale?: string; placementCode: string; planSlug: string }) {
    const now = new Date();
    const rows = await this.prisma.adCampaign.findMany({
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      where: { policyStatus: "ok", status: "active" }
    });
    for (const c of rows) {
      const codes = c.placementCodes as string[];
      if (!codes.includes(input.placementCode)) {
        continue;
      }
      if (c.startAt && c.startAt > now) {
        continue;
      }
      if (c.endAt && c.endAt < now) {
        continue;
      }
      if (c.targetPlanSlug && c.targetPlanSlug !== input.planSlug) {
        continue;
      }
      if (c.targetLocale && c.targetLocale !== input.locale) {
        continue;
      }
      return c;
    }
    return null;
  }

  private async recordBlocked(input: {
    decisionKey: string;
    placementId: string;
    userId: string | null;
  }) {
    await this.prisma.adImpression.create({
      data: {
        decisionKey: input.decisionKey,
        kind: "blocked",
        placementId: input.placementId,
        userId: input.userId
      }
    });
  }
}
