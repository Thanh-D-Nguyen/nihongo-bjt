import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LearnerMonetizationController } from "./learner-monetization.controller.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

describe("LearnerMonetizationController feature gate", () => {
  const originalStripeSecretKey = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "test_stripe_key";
  });

  afterEach(() => {
    if (originalStripeSecretKey === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalStripeSecretKey;
    }
  });

  it("blocks checkout when billing feature is disabled", async () => {
    const billing = { startLocalCheckout: vi.fn() };
    const ads = { decide: vi.fn() };
    const entitlements = { listEntitlementKeysForUser: vi.fn() };
    const quota = { getFlashcardDaySummary: vi.fn() };
    const legalConsent = { requireCheckoutConsent: vi.fn() };
    const featureGate = {
      requireEnabled: vi.fn().mockRejectedValue(new ServiceUnavailableException("disabled"))
    };

    const stripeBilling = { startCheckout: vi.fn() };

    const monetizationRepo = { resolvePlanForUser: vi.fn() };

    const controller = new LearnerMonetizationController(
      billing as any,
      stripeBilling as any,
      ads as any,
      entitlements as any,
      quota as any,
      featureGate as any,
      legalConsent as any,
      monetizationRepo as any
    );

    await expect(
      controller.checkout(
        { appUserId: "22222222-2222-4222-8222-222222222222" } as any,
        { planSlug: "premium", userId: "22222222-2222-4222-8222-222222222222" }
      )
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(stripeBilling.startCheckout).not.toHaveBeenCalled();
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

    const stripeBilling = { startCheckout: vi.fn() };

    const monetizationRepo = { resolvePlanForUser: vi.fn() };

    const controller = new LearnerMonetizationController(
      billing as any,
      stripeBilling as any,
      ads as any,
      entitlements as any,
      quota as any,
      featureGate as any,
      legalConsent as any,
      monetizationRepo as any
    );

    await expect(
      controller.checkout({ appUserId: "22222222-2222-4222-8222-222222222222" } as any, {
        planSlug: "premium",
        userId: "22222222-2222-4222-8222-222222222222"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(stripeBilling.startCheckout).not.toHaveBeenCalled();
  });
});
