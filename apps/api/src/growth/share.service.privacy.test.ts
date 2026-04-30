import { describe, expect, it, vi } from "vitest";

import { ShareService } from "./share.service.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

describe("ShareService privacy boundaries", () => {
  it("rejects share creation when learner did not opt in", async () => {
    const service = new ShareService();

    (service as any).prisma = {
      shareTemplate: {
        findFirst: vi.fn().mockResolvedValue({
          id: "tpl-1"
        })
      },
      userProfile: {
        findFirst: vi.fn().mockResolvedValue({ id: "user-1", sharePostcardOptIn: false })
      }
    };

    await expect(
      service.createForUser({
        kind: "streak",
        payload: { streakDays: 10 },
        userId: "00000000-0000-4000-8000-000000000001"
      })
    ).rejects.toMatchObject({
      response: {
        code: "share_opt_in_required"
      }
    });
  });

  it("keeps score percentage private unless includeScorePercent is explicitly true", () => {
    const service = new ShareService();

    expect(
      service.toSafeSummary({
        kind: "bjt_result",
        payload: { band: "J2", scorePercent: 86 },
        userId: "00000000-0000-4000-8000-000000000001"
      })
    ).toEqual({ band: "J2" });

    expect(
      service.toSafeSummary({
        kind: "bjt_result",
        payload: { band: "J2", includeScorePercent: true, scorePercent: 86 },
        userId: "00000000-0000-4000-8000-000000000001"
      })
    ).toEqual({ band: "J2", scorePercent: 86 });
  });
});
