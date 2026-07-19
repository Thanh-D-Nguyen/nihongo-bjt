import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import {
  isScheduledDrawDate,
  jstDateKey,
  nextScheduledDrawDate,
  resolveAutopilotTarget,
  toDatabaseDate
} from "./loto-calendar.js";

describe("Loto calendar", () => {
  it("uses UTC midnight for Prisma DATE values", () => {
    expect(toDatabaseDate("2026-07-20").toISOString()).toBe("2026-07-20T00:00:00.000Z");
  });

  it("recognizes official draw weekdays using calendar dates", () => {
    expect(isScheduledDrawDate("loto6", "2026-07-20")).toBe(true);
    expect(isScheduledDrawDate("loto6", "2026-07-23")).toBe(true);
    expect(isScheduledDrawDate("loto7", "2026-07-24")).toBe(true);
    expect(isScheduledDrawDate("loto7", "2026-07-23")).toBe(false);
  });

  it("resolves the first scheduled draw strictly after an imported result", () => {
    expect(nextScheduledDrawDate("loto6", "2026-07-16")).toBe("2026-07-20");
    expect(nextScheduledDrawDate("loto7", "2026-07-17")).toBe("2026-07-24");
  });

  it("waits when the latest scheduled result has not landed yet", () => {
    expect(resolveAutopilotTarget("loto6", "2026-07-13", "2026-07-16")).toEqual({
      status: "waiting_result",
      targetDrawDate: "2026-07-16"
    });
  });

  it("becomes ready as soon as the latest result advances the next target", () => {
    expect(resolveAutopilotTarget("loto6", "2026-07-16", "2026-07-19")).toEqual({
      status: "ready",
      targetDrawDate: "2026-07-20"
    });
  });

  it("computes the current JST calendar date without server timezone dependence", () => {
    expect(jstDateKey(new Date("2026-07-19T15:30:00.000Z"))).toBe("2026-07-20");
  });

  it("rejects impossible dates", () => {
    expect(() => toDatabaseDate("2026-02-30")).toThrow(BadRequestException);
  });
});
