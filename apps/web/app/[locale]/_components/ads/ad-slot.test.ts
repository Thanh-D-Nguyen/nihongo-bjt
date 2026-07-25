import { describe, expect, it } from "vitest";

import { isRenderableAdDecision } from "./ad-slot";

describe("AdSlot decision safety", () => {
  it("never renders provider placeholders as real ads", () => {
    expect(
      isRenderableAdDecision({
        decisionKey: "local:no_active_campaign",
        eligible: true,
        payload: {
          campaign: {
            creativeType: "placeholder",
            id: "placeholder:home_feed_inline",
            name: "Ad space"
          }
        }
      })
    ).toBe(false);
  });

  it("renders an active configured campaign", () => {
    expect(
      isRenderableAdDecision({
        campaignId: "58bfc8a5-5e52-4ca2-9b8f-fb143601cfb7",
        decisionKey: "local:default",
        eligible: true,
        payload: {
          campaign: {
            creativeType: "storefront",
            destinationUrl: "https://example.com/store",
            id: "58bfc8a5-5e52-4ca2-9b8f-fb143601cfb7",
            name: "Storefront"
          }
        }
      })
    ).toBe(true);
  });
});
