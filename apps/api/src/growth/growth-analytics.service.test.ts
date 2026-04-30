import { describe, expect, it, vi } from "vitest";

import { GrowthAnalyticsService } from "./growth-analytics.service.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

describe("GrowthAnalyticsService referral/share funnel", () => {
  it("returns aggregate-only funnel metrics from real analytics events", async () => {
    const service = new GrowthAnalyticsService();
    const groupBy = vi.fn().mockResolvedValue([
      { _count: { _all: 10 }, eventName: "referral_link_view" },
      { _count: { _all: 4 }, eventName: "referral_signup" },
      { _count: { _all: 3 }, eventName: "share_item_created" }
    ]);
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ count: 3n }])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([
        { day: "2026-04-29", referral_link_view: 6n, referral_signup: 2n, share_item_created: 1n },
        { day: "2026-04-30", referral_link_view: 4n, referral_signup: 2n, share_item_created: 2n }
      ]);

    (service as any).prisma = {
      analyticsEvent: { groupBy },
      $queryRaw: queryRaw
    };

    const res = await service.referralShareFunnel(30);

    expect(res.funnel).toEqual({
      referralLinkViews: 10,
      referralSignups: 4,
      shareItemsCreated: 3,
      shareItemsFromOptedInUsers: 3
    });
    expect(res.integrity.shareEventsWithoutOptIn).toBe(0);
    expect(res.rates.signupFromReferralView).toBe(0.4);
    expect(res.rates.sharePerReferralSignup).toBe(0.75);
    expect(res.privacyBoundary.aggregateOnly).toBe(true);
    expect(res.privacyBoundary.excludedFields).toContain("analytics_event.user_id");
    expect(res.seriesByDay).toHaveLength(2);
  });

  it("clamps out-of-range lookback days", async () => {
    const service = new GrowthAnalyticsService();
    const groupBy = vi.fn().mockResolvedValue([]);
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([]);

    (service as any).prisma = {
      analyticsEvent: { groupBy },
      $queryRaw: queryRaw
    };

    const res = await service.referralShareFunnel(999);

    expect(res.range.days).toBe(90);
  });
});
