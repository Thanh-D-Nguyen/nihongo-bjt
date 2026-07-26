import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SIGNING_SECRET = "test-ad-decision-signing-secret-32-chars";
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const PLACEMENT_ID = "11111111-1111-4111-8111-111111111111";

const prismaMock = {
  adCampaign: { findFirst: vi.fn() },
  adImpression: { create: vi.fn() },
  adPlacement: { findFirst: vi.fn() }
};

vi.mock("@nihongo-bjt/database", () => ({
  createPrismaClient: () => prismaMock
}));

import { signAdDecisionToken } from "./ad-decision-token.js";
import { AdsRuntimeService } from "./ads-runtime.service.js";

function token(subject = "anonymous") {
  return signAdDecisionToken(
    {
      campaignId: CAMPAIGN_ID,
      decisionKey: "local:default",
      placementCode: "home_feed_inline",
      subject
    },
    SIGNING_SECRET
  );
}

describe("AdsRuntimeService anonymous events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADS_DECISION_SIGNING_SECRET = SIGNING_SECRET;
    prismaMock.adPlacement.findFirst.mockResolvedValue({
      code: "home_feed_inline",
      id: PLACEMENT_ID
    });
    prismaMock.adCampaign.findFirst.mockResolvedValue({
      id: CAMPAIGN_ID,
      placementCodes: ["home_feed_inline"],
      policyStatus: "ok",
      status: "active"
    });
    prismaMock.adImpression.create.mockResolvedValue({});
  });

  it("issues a signed token for an eligible anonymous decision", async () => {
    const service = new AdsRuntimeService({
      decide: vi.fn().mockResolvedValue({
        campaignId: CAMPAIGN_ID,
        decisionKey: "local:default",
        eligible: true
      })
    } as any);

    await expect(
      service.decide({
        placementCode: "home_feed_inline",
        userId: null
      })
    ).resolves.toMatchObject({
      campaignId: CAMPAIGN_ID,
      decisionToken: expect.any(String),
      eligible: true
    });
  });

  it("persists a verified anonymous impression with a null user id", async () => {
    const service = new AdsRuntimeService({ decide: vi.fn() } as any);

    await service.recordImpression(null, {
      campaignId: CAMPAIGN_ID,
      decisionKey: "local:default",
      decisionToken: token(),
      kind: "impression",
      placementCode: "home_feed_inline"
    });

    expect(prismaMock.adImpression.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: CAMPAIGN_ID,
        decisionKey: expect.stringMatching(/^decision:.*:impression$/u),
        userId: null
      })
    });
  });

  it("rejects a forged decision token before persistence", async () => {
    const service = new AdsRuntimeService({ decide: vi.fn() } as any);
    const signed = token();
    const [payload, signature] = signed.split(".");
    const forged = `${payload?.startsWith("A") ? "B" : "A"}${payload?.slice(1)}.${signature}`;

    await expect(
      service.recordImpression(null, {
        campaignId: CAMPAIGN_ID,
        decisionKey: "local:default",
        decisionToken: forged,
        kind: "impression",
        placementCode: "home_feed_inline"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.adImpression.create).not.toHaveBeenCalled();
  });

  it("rejects a token bound to another subject", async () => {
    const service = new AdsRuntimeService({ decide: vi.fn() } as any);

    await expect(
      service.recordClick(null, {
        campaignId: CAMPAIGN_ID,
        decisionKey: "local:default",
        decisionToken: token("33333333-3333-4333-8333-333333333333"),
        placementCode: "home_feed_inline"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects inactive or unapproved campaigns at event time", async () => {
    prismaMock.adCampaign.findFirst.mockResolvedValue(null);
    const service = new AdsRuntimeService({ decide: vi.fn() } as any);

    await expect(
      service.recordClick(null, {
        campaignId: CAMPAIGN_ID,
        decisionKey: "local:default",
        decisionToken: token(),
        placementCode: "home_feed_inline"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("treats duplicate signed events as idempotent", async () => {
    prismaMock.adImpression.create.mockRejectedValue({ code: "P2002" });
    const service = new AdsRuntimeService({ decide: vi.fn() } as any);

    await expect(
      service.recordClick(null, {
        campaignId: CAMPAIGN_ID,
        decisionKey: "local:default",
        decisionToken: token(),
        placementCode: "home_feed_inline"
      })
    ).resolves.toEqual({ duplicate: true, ok: true });
  });

  it("rejects a user id that does not match the authenticated principal", async () => {
    const service = new AdsRuntimeService({ decide: vi.fn() } as any);

    await expect(
      service.recordClick(PLACEMENT_ID, {
        campaignId: CAMPAIGN_ID,
        decisionToken: token(PLACEMENT_ID),
        placementCode: "home_feed_inline",
        userId: "33333333-3333-4333-8333-333333333333"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.adImpression.create).not.toHaveBeenCalled();
  });
});
