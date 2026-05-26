import "reflect-metadata";

import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {};

vi.mock("@nihongo-bjt/database", () => ({
  createPrismaClient: () => prismaMock
}));

import { RuntimeFeatureGateService } from "../operations/runtime-feature-gate.service.js";
import { EntitlementKey, FeatureFlagKey } from "./monetization.constants.js";
import { EntitlementService } from "./entitlement.service.js";
import { MonetizationRepository } from "./monetization.repository.js";

describe("EntitlementService", () => {
  const repository = {
    resolvePlanForUser: vi.fn()
  };
  const featureGate = {
    status: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository.resolvePlanForUser.mockResolvedValue({
      plan: {
        entitlements: [
          { entitlement: { key: EntitlementKey.learner_basic } }
        ],
        slug: "free"
      }
    });
  });

  it("treats every entitlement as available when monetization enforcement is off", async () => {
    featureGate.status.mockResolvedValue({
      configured: true,
      enabled: false,
      key: FeatureFlagKey.monetization_enforcement,
      killSwitch: false
    });

    const service = new EntitlementService(
      repository as unknown as MonetizationRepository,
      featureGate as unknown as RuntimeFeatureGateService
    );

    await expect(
      service.has("22222222-2222-4222-8222-222222222222", EntitlementKey.flashcard_premium_styles)
    ).resolves.toBe(true);
    await expect(
      service.has("22222222-2222-4222-8222-222222222222", EntitlementKey.flashcard_suggest_cards)
    ).resolves.toBe(true);
    expect(featureGate.status).toHaveBeenCalledWith(FeatureFlagKey.monetization_enforcement, {
      missingBehavior: "allow"
    });
  });

  it("uses plan entitlements when monetization enforcement is on", async () => {
    featureGate.status.mockResolvedValue({
      configured: true,
      enabled: true,
      key: FeatureFlagKey.monetization_enforcement,
      killSwitch: false
    });

    const service = new EntitlementService(
      repository as unknown as MonetizationRepository,
      featureGate as unknown as RuntimeFeatureGateService
    );

    await expect(
      service.has("22222222-2222-4222-8222-222222222222", EntitlementKey.flashcard_premium_styles)
    ).resolves.toBe(false);
    await expect(
      service.has("22222222-2222-4222-8222-222222222222", EntitlementKey.learner_basic)
    ).resolves.toBe(true);
  });

  it("declares explicit Nest injection tokens", () => {
    const deps = Reflect.getMetadata("self:paramtypes", EntitlementService) as
      | Array<{ index: number; param: unknown }>
      | undefined;

    expect(deps).toEqual(
      expect.arrayContaining([
        { index: 0, param: MonetizationRepository },
        { index: 1, param: RuntimeFeatureGateService }
      ])
    );
  });
});
