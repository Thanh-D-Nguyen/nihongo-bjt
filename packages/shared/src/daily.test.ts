import { describe, expect, it } from "vitest";

import { greetingForHour, todayDateKey } from "./daily.js";

describe("daily helpers", () => {
  it("returns morning greeting before late morning", () => {
    expect(greetingForHour(8).japanese).toBe("おはようございます");
  });

  it("returns workplace greeting during the day", () => {
    expect(greetingForHour(14).japanese).toBe("お疲れさまです");
  });

  it("formats daily content keys as UTC dates", () => {
    expect(todayDateKey(new Date("2026-04-26T00:10:00.000Z"))).toBe("2026-04-26");
  });
});
