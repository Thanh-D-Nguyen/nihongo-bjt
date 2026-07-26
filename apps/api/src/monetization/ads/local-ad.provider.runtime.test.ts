import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  adCampaign: { findMany: vi.fn() },
  adImpression: { count: vi.fn(), create: vi.fn() },
  adPlacement: { findFirst: vi.fn() },
  adProviderConfig: { findFirst: vi.fn() },
  adSafetyRule: { findFirst: vi.fn() },
  userProfile: { findUnique: vi.fn() }
};

vi.mock("@nihongo-bjt/database", () => ({
  createPrismaClient: () => prismaMock
}));

import { EntitlementKey } from "../monetization.constants.js";
import { LocalAdProvider } from "./local-ad.provider.js";

describe("LocalAdProvider anonymous and entitlement decisions", () => {
  const entitlements = {
    listEntitlementKeysForUser: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.adPlacement.findFirst.mockResolvedValue({
      active: true,
      code: "home_feed_inline",
      config: {
        allowedPlanSlugs: ["free"],
        maxPerDay: 12,
        providerKey: "local"
      },
      id: "11111111-1111-4111-8111-111111111111",
      labelKey: "ads.home"
    });
    prismaMock.adProviderConfig.findFirst.mockResolvedValue({
      config: { personalized: false },
      enabled: true,
      key: "local",
      type: "local"
    });
    prismaMock.adSafetyRule.findFirst.mockImplementation(
      ({ where }: { where: { ruleKey: string } }) =>
        Promise.resolve(
          where.ruleKey === "require_personalized_ads_opt_in"
            ? { config: { required: true }, enabled: true }
            : null
        )
    );
    prismaMock.adCampaign.findMany.mockResolvedValue([
      {
        creativeType: "storefront",
        destinationUrl: "https://example.com/store",
        endAt: null,
        id: "22222222-2222-4222-8222-222222222222",
        maxImpressions: null,
        name: "Configured storefront",
        placementCodes: ["home_feed_inline"],
        priority: 100,
        startAt: null,
        targetLocale: "vi",
        targetPlanSlug: "free",
        updatedAt: new Date()
      }
    ]);
    prismaMock.adImpression.create.mockResolvedValue({});
  });

  it("serves a configured contextual campaign to an anonymous free viewer", async () => {
    const provider = new LocalAdProvider(entitlements as any);

    const decision = await provider.decide({
      learningContext: { planSlug: "premium", sessionKind: "default" },
      locale: "vi",
      placementCode: "home_feed_inline",
      userId: null
    });

    expect(decision).toMatchObject({
      campaignId: "22222222-2222-4222-8222-222222222222",
      decisionKey: "local:default",
      eligible: true
    });
    expect(entitlements.listEntitlementKeysForUser).not.toHaveBeenCalled();
    expect(prismaMock.adImpression.count).not.toHaveBeenCalled();
    expect(prismaMock.adCampaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { policyStatus: "ok", status: "active" }
      })
    );
  });

  it("uses the authenticated server plan instead of a client plan hint", async () => {
    entitlements.listEntitlementKeysForUser.mockResolvedValue({
      entitlements: [],
      planSlug: "free"
    });
    const provider = new LocalAdProvider(entitlements as any);

    await expect(
      provider.decide({
        learningContext: { planSlug: "premium", sessionKind: "default" },
        locale: "vi",
        placementCode: "home_feed_inline",
        userId: "33333333-3333-4333-8333-333333333333"
      })
    ).resolves.toMatchObject({
      campaignId: "22222222-2222-4222-8222-222222222222",
      eligible: true
    });
  });

  it.each([
    [EntitlementKey.ads_remove, "local:ads_remove"],
    [EntitlementKey.ads_reduced, "local:ads_reduced"]
  ])("blocks authenticated users with %s", async (entitlement, decisionKey) => {
    entitlements.listEntitlementKeysForUser.mockResolvedValue({
      entitlements: [entitlement],
      planSlug: "premium"
    });
    const provider = new LocalAdProvider(entitlements as any);

    await expect(
      provider.decide({
        locale: "vi",
        placementCode: "home_feed_inline",
        userId: "33333333-3333-4333-8333-333333333333"
      })
    ).resolves.toEqual({ decisionKey, eligible: false });
    expect(prismaMock.adImpression.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        decisionKey,
        kind: "blocked",
        userId: "33333333-3333-4333-8333-333333333333"
      })
    });
  });

  it("blocks anonymous viewers when a configured provider requires personalization consent", async () => {
    prismaMock.adProviderConfig.findFirst.mockResolvedValue({
      config: { personalized: true },
      enabled: true,
      key: "local",
      type: "local"
    });
    const provider = new LocalAdProvider(entitlements as any);

    await expect(
      provider.decide({
        locale: "vi",
        placementCode: "home_feed_inline",
        userId: null
      })
    ).resolves.toEqual({
      decisionKey: "privacy:personalization_opt_in_required",
      eligible: false
    });
    expect(prismaMock.userProfile.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.adImpression.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        decisionKey: "privacy:personalization_opt_in_required",
        userId: null
      })
    });
  });

  it("preserves learning-session safety for anonymous viewers", async () => {
    prismaMock.adSafetyRule.findFirst.mockImplementation(
      ({ where }: { where: { ruleKey: string } }) =>
        Promise.resolve(
          where.ruleKey === "learning_session_blocks"
            ? {
                config: { sessionKinds: ["bjt_timed"] },
                enabled: true
              }
            : null
        )
    );
    const provider = new LocalAdProvider(entitlements as any);

    await expect(
      provider.decide({
        learningContext: { sessionKind: "bjt_timed" },
        placementCode: "home_feed_inline",
        userId: null
      })
    ).resolves.toEqual({
      decisionKey: "safety:learning_session:bjt_timed",
      eligible: false
    });
    expect(prismaMock.adCampaign.findMany).not.toHaveBeenCalled();
  });
});
