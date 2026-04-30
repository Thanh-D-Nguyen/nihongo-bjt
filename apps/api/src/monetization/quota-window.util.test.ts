import { describe, expect, it } from "vitest";

import { utcDateKey } from "./quota-window.util.js";

describe("utcDateKey", () => {
  it("formats UTC YYYY-MM-DD for a fixed instant", () => {
    const d = new Date("2026-04-26T15:00:00.000Z");
    expect(utcDateKey(d)).toBe("2026-04-26");
  });
});
