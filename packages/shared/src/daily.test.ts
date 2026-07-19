import { describe, expect, it } from "vitest";

import { dateKeyInTimeZone, greetingForHour, hourInTimeZone, todayDateKey } from "./daily.js";

describe("daily helpers", () => {
  it("returns morning greeting before late morning", () => {
    expect(greetingForHour(10)).toEqual({ japanese: "おはようございます", reading: null });
  });

  it("returns workplace greeting during the day", () => {
    expect(greetingForHour(11)).toEqual({
      japanese: "お疲れさまです",
      reading: "おつかれさまです"
    });
    expect(greetingForHour(17).japanese).toBe("お疲れさまです");
  });

  it("returns an evening greeting from 18:00", () => {
    expect(greetingForHour(18)).toEqual({ japanese: "こんばんは", reading: null });
  });

  it("rejects invalid hours", () => {
    expect(() => greetingForHour(24)).toThrow(RangeError);
  });

  it("resolves the learner hour and date in an IANA timezone", () => {
    const instant = new Date("2026-07-19T08:30:00.000Z");
    expect(hourInTimeZone(instant, "Asia/Ho_Chi_Minh")).toBe(15);
    expect(dateKeyInTimeZone(new Date("2026-07-19T18:00:00.000Z"), "Asia/Ho_Chi_Minh")).toBe(
      "2026-07-20"
    );
  });

  it("formats daily content keys as UTC dates", () => {
    expect(todayDateKey(new Date("2026-04-26T00:10:00.000Z"))).toBe("2026-04-26");
  });
});
