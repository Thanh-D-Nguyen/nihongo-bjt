import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { LearnerMonetizationController } from "./learner-monetization.controller.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

describe("LearnerMonetizationController feature gate", () => {
  it("blocks checkout when billing feature is disabled", async () => {
    const billing = { startLocalCheckout: vi.fn() };
    const ads = { decide: vi.fn() };
    const entitlements = { listEntitlementKeysForUser: vi.fn() };
    const quota = { getFlashcardDaySummary: vi.fn() };
    const legalConsent = { requireCheckoutConsent: vi.fn() };
    const featureGate = {
      requireEnabled: vi.fn().mockRejectedValue(new ServiceUnavailableException("disabled"))
    };

    const controller = new LearnerMonetizationController(
      billing as any,
      ads as any,
      entitlements as any,
      quota as any,
      featureGate as any,
      legalConsent as any
    );

    await expect(
      controller.checkout(
        { appUserId: "22222222-2222-4222-8222-222222222222" } as any,
        { planSlug: "premium", userId: "22222222-2222-4222-8222-222222222222" }
      )
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(billing.startLocalCheckout).not.toHaveBeenCalled();
  });

  it("blocks checkout when legal consent is missing", async () => {
    const billing = { startLocalCheckout: vi.fn() };
    const ads = { decide: vi.fn() };
    const entitlements = { listEntitlementKeysForUser: vi.fn() };
    const quota = { getFlashcardDaySummary: vi.fn() };
    const featureGate = { requireEnabled: vi.fn().mockResolvedValue(undefined) };
    const legalConsent = {
      requireCheckoutConsent: vi
        .fn()
        .mockRejectedValue(new ForbiddenException({ code: "CONSENT_REQUIRED" }))
    };

    const controller = new LearnerMonetizationController(
      billing as any,
      ads as any,
      entitlements as any,
      quota as any,
      featureGate as any,
      legalConsent as any
    );

    await expect(
      controller.checkout({ appUserId: "22222222-2222-4222-8222-222222222222" } as any, {
        planSlug: "premium",
        userId: "22222222-2222-4222-8222-222222222222"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(billing.startLocalCheckout).not.toHaveBeenCalled();
  });
});
