import { describe, expect, it, vi } from "vitest";

import { ReferralService } from "./referral.service.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

describe("ReferralService analytics boundary", () => {
  it("records referral_link_view without referral code or user binding", async () => {
    const service = new ReferralService();
    const analyticsCreate = vi.fn().mockResolvedValue(undefined);

    (service as any).prisma = {
      analyticsEvent: { create: analyticsCreate },
      referralCode: { findFirst: vi.fn().mockResolvedValue({ code: "abcd1234", userId: "user-1" }) },
      referralEvent: { create: vi.fn().mockResolvedValue(undefined) }
    };

    await service.recordLinkClick("ABCD1234");

    expect(analyticsCreate).toHaveBeenCalledWith({
      data: {
        eventName: "referral_link_view",
        payload: { channel: "referral" },
        source: "api"
      }
    });
    const payload = analyticsCreate.mock.calls[0][0].data.payload as Record<string, unknown>;
    expect(payload.code).toBeUndefined();
    expect(analyticsCreate.mock.calls[0][0].data.userId).toBeUndefined();
  });

  it("records referral_signup without referral code in analytics payload", async () => {
    const service = new ReferralService();
    const analyticsCreate = vi.fn().mockResolvedValue(undefined);

    (service as any).prisma = {
      analyticsEvent: { create: analyticsCreate },
      monetizationAuditLog: { create: vi.fn().mockResolvedValue(undefined) },
      referralCode: { findFirst: vi.fn().mockResolvedValue({ code: "abcd1234", userId: "user-ref" }) },
      referralEvent: { create: vi.fn().mockResolvedValue(undefined) },
      referralQuotaCredit: { create: vi.fn().mockResolvedValue(undefined) }
    };

    await service.onReferredSignup({
      refCode: "abcd1234",
      referredUserId: "00000000-0000-4000-8000-000000000123"
    });

    expect(analyticsCreate).toHaveBeenCalledWith({
      data: {
        eventName: "referral_signup",
        payload: {
          channel: "referral",
          rewardReason: "referral_signup_bonus"
        },
        source: "api",
        userId: "00000000-0000-4000-8000-000000000123"
      }
    });
    const payload = analyticsCreate.mock.calls[0][0].data.payload as Record<string, unknown>;
    expect(payload.code).toBeUndefined();
  });
});
