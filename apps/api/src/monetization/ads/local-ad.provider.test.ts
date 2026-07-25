import { describe, expect, it } from "vitest";

import { isPersonalizedAdConfig } from "./local-ad.provider.js";

describe("isPersonalizedAdConfig", () => {
  it("does not require personalization consent for the contextual local storefront", () => {
    expect(
      isPersonalizedAdConfig(
        { providerKey: "local", surface: "home" },
        { label: "local", personalized: false }
      )
    ).toBe(false);
  });

  it("detects personalization declared by either placement or provider", () => {
    expect(isPersonalizedAdConfig({ personalized: true }, {})).toBe(true);
    expect(isPersonalizedAdConfig({}, { personalized: true })).toBe(true);
  });
});
