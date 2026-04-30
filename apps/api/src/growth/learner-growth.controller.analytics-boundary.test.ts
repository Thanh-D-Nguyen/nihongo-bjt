import { describe, expect, it, vi } from "vitest";

import { LearnerGrowthController } from "./learner-growth.controller.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

describe("LearnerGrowthController analytics payload boundary", () => {
  it("does not persist public token in share_item_created analytics payload", async () => {
    const share = {
      createForUser: vi.fn().mockResolvedValue({
        publicToken: "public-token-123",
        shareUrl: "https://example.test/share/public-token-123"
      })
    };
    const referral = {};
    const featureGate = { requireEnabled: vi.fn().mockResolvedValue(undefined) };

    const controller = new LearnerGrowthController(share as any, referral as any, featureGate as any);
    const analyticsCreate = vi.fn().mockResolvedValue(undefined);
    (controller as any).prisma = { analyticsEvent: { create: analyticsCreate } };

    await controller.createShare(undefined, {
      kind: "streak",
      payload: { streakDays: 7 },
      userId: "00000000-0000-4000-8000-000000000111"
    });

    expect(analyticsCreate).toHaveBeenCalledWith({
      data: {
        eventName: "share_item_created",
        payload: { consent: "share_postcard_opt_in", kind: "streak" },
        source: "api",
        userId: "00000000-0000-4000-8000-000000000111"
      }
    });
    const payload = analyticsCreate.mock.calls[0][0].data.payload as Record<string, unknown>;
    expect(payload.publicToken).toBeUndefined();
  });
});
