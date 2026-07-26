import { describe, expect, it } from "vitest";

import {
  AD_DECISION_TOKEN_TTL_MS,
  signAdDecisionToken,
  verifyAdDecisionToken
} from "./ad-decision-token.js";

const secret = "test-ad-decision-signing-secret-32-chars";
const now = Date.UTC(2026, 6, 26, 12, 0, 0);

describe("ad decision token", () => {
  it("round-trips signed claims", () => {
    const signed = signAdDecisionToken(
      {
        campaignId: "22222222-2222-4222-8222-222222222222",
        decisionKey: "local:default",
        placementCode: "home_feed_inline",
        subject: "anonymous"
      },
      secret,
      now
    );

    expect(verifyAdDecisionToken(signed, secret, now + 1)).toMatchObject({
      campaignId: "22222222-2222-4222-8222-222222222222",
      decisionKey: "local:default",
      placementCode: "home_feed_inline",
      subject: "anonymous",
      version: 1
    });
  });

  it("rejects tampering and expiry", () => {
    const signed = signAdDecisionToken(
      {
        campaignId: "22222222-2222-4222-8222-222222222222",
        decisionKey: "local:default",
        placementCode: "home_feed_inline",
        subject: "anonymous"
      },
      secret,
      now
    );

    const [payload, signature] = signed.split(".");
    const tampered = `${payload?.startsWith("A") ? "B" : "A"}${payload?.slice(1)}.${signature}`;
    expect(() => verifyAdDecisionToken(tampered, secret, now + 1)).toThrow();
    expect(() => verifyAdDecisionToken(signed, secret, now + AD_DECISION_TOKEN_TTL_MS)).toThrow(
      "Expired"
    );
  });
});
