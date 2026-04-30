import { describe, expect, it } from "vitest";

import { scheduleSrsReview, type SrsState } from "./srs.js";

const baseState: SrsState = {
  dueAt: new Date("2026-04-25T00:00:00.000Z"),
  easeFactor: 2.5,
  intervalDays: 0,
  lapses: 0,
  repetitions: 0,
  state: "new"
};

describe("scheduleSrsReview", () => {
  it("schedules again reviews deterministically in ten minutes", () => {
    const reviewedAt = new Date("2026-04-25T12:00:00.000Z");
    const next = scheduleSrsReview(baseState, "again", reviewedAt);

    expect(next).toMatchObject({
      dueAt: new Date("2026-04-25T12:10:00.000Z"),
      intervalDays: 0,
      lapses: 1,
      repetitions: 0,
      state: "lapsed"
    });
  });

  it("graduates good reviews into review state after the second success", () => {
    const first = scheduleSrsReview(baseState, "good", new Date("2026-04-25T00:00:00.000Z"));
    const second = scheduleSrsReview(first, "good", new Date("2026-04-26T00:00:00.000Z"));

    expect(first.state).toBe("learning");
    expect(second).toMatchObject({
      intervalDays: 4,
      repetitions: 2,
      state: "review"
    });
  });
});
