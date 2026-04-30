import { describe, expect, it } from "vitest";

import { coachingInsight, percentage, toUtcDateKey } from "./analytics.js";

describe("analytics helpers", () => {
  it("formats UTC metric date keys", () => {
    expect(toUtcDateKey(new Date("2026-04-25T15:30:00.000Z"))).toBe("2026-04-25");
  });

  it("calculates rounded percentages safely", () => {
    expect(percentage(2, 3)).toBe(66.7);
    expect(percentage(1, 0)).toBe(0);
  });

  it("generates a coaching insight for low accuracy", () => {
    expect(coachingInsight({ bjtAccuracyPct: 45, reviewCount: 10, streakDays: 2 })).toContain(
      "missed items"
    );
  });
});
