import { describe, expect, it } from "vitest";

import { authProfileUpdateSchema, bookmarkParamsSchema } from "./index.js";

describe("backend API contract schemas", () => {
  it("validates canonical auth profile update fields", () => {
    const parsed = authProfileUpdateSchema.parse({
      dailyGoalCards: 30,
      displayName: "Thanh",
      explanationLocale: "vi",
      targetBjtBand: "J2",
      timezone: "Asia/Tokyo",
      uiLocale: "ja"
    });

    expect(parsed.displayName).toBe("Thanh");
    expect(parsed.uiLocale).toBe("ja");
  });

  it("rejects invalid bookmark target params", () => {
    expect(() =>
      bookmarkParamsSchema.parse({
        id: "not-a-uuid",
        type: "achievement"
      })
    ).toThrow();
  });
});
