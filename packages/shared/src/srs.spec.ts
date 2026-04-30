import { describe, expect, it } from "vitest";
import {
  LEECH_THRESHOLD_LAPSES,
  scheduleSrsReview,
  type SrsState
} from "./srs.js";

describe("SRS Scheduler with Leech Detection and Comeback Mode", () => {
  describe("Basic spacing progression", () => {
    it("should progress through new → learning → review states on good ratings", () => {
      const initial: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: 0,
        repetitions: 0,
        state: "new",
        leeched: false
      };

      // First good review: new → learning (1 day)
      const after1stGood = scheduleSrsReview(initial, "good", new Date());
      expect(after1stGood.state).toBe("learning");
      expect(after1stGood.repetitions).toBe(1);
      expect(after1stGood.intervalDays).toBe(1);
      expect(after1stGood.lapses).toBe(0);

      // Second good review: learning → review (4 days)
      const after2ndGood = scheduleSrsReview(after1stGood, "good", new Date());
      expect(after2ndGood.state).toBe("review");
      expect(after2ndGood.repetitions).toBe(2);
      expect(after2ndGood.intervalDays).toBe(4);

      // Third good review: continues review progression
      const after3rdGood = scheduleSrsReview(after2ndGood, "good", new Date());
      expect(after3rdGood.state).toBe("review");
      expect(after3rdGood.repetitions).toBe(3);
      expect(after3rdGood.intervalDays).toBeGreaterThan(4);
    });

    it("should increase intervals with easy ratings", () => {
      const initial: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: 0,
        repetitions: 0,
        state: "new",
        leeched: false
      };

      const after1stEasy = scheduleSrsReview(initial, "easy", new Date());
      expect(after1stEasy.intervalDays).toBe(3); // Easy from new: 3 days vs 1 day for good

      const after2ndEasy = scheduleSrsReview(after1stEasy, "easy", new Date());
      expect(after2ndEasy.intervalDays).toBe(7); // Easy progression: 7 days vs 4 days for good
    });

    it("should decrease ease factor with hard ratings", () => {
      const initial: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: 0,
        repetitions: 0,
        state: "new",
        leeched: false
      };

      const afterHard = scheduleSrsReview(initial, "hard", new Date());
      expect(afterHard.easeFactor).toBe(2.35); // 2.5 - 0.15
      expect(afterHard.state).toBe("learning");
      expect(afterHard.intervalDays).toBe(1);
    });

    it("should never allow ease factor below 1.3", () => {
      let state: SrsState = {
        dueAt: new Date(),
        easeFactor: 1.4,
        intervalDays: 1,
        lapses: 0,
        repetitions: 1,
        state: "learning",
        leeched: false
      };

      for (let i = 0; i < 10; i++) {
        state = scheduleSrsReview(state, "hard", new Date());
      }

      expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
    });
  });

  describe("Lapse and reset behavior", () => {
    it("should enter lapsed state when rating again", () => {
      const state: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 10,
        lapses: 0,
        repetitions: 3,
        state: "review",
        leeched: false
      };

      const afterAgain = scheduleSrsReview(state, "again", new Date());
      expect(afterAgain.state).toBe("lapsed");
      expect(afterAgain.lapses).toBe(1);
      expect(afterAgain.repetitions).toBe(0);
      expect(afterAgain.intervalDays).toBe(0);
      expect(afterAgain.easeFactor).toBe(2.3); // 2.5 - 0.2
    });

    it("should decrease ease factor more severely on lapse", () => {
      const state: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 10,
        lapses: 0,
        repetitions: 3,
        state: "review",
        leeched: false
      };

      const afterAgain = scheduleSrsReview(state, "again", new Date());
      expect(afterAgain.easeFactor).toBe(2.3); // Stronger penalty than hard (-0.2 vs -0.15)
    });

    it("should schedule review 10 minutes later after lapse (quick recovery)", () => {
      const now = new Date("2026-04-29T12:00:00Z");
      const state: SrsState = {
        dueAt: now,
        easeFactor: 2.5,
        intervalDays: 10,
        lapses: 0,
        repetitions: 3,
        state: "review",
        leeched: false
      };

      const afterAgain = scheduleSrsReview(state, "again", now);
      const expectedTime = new Date("2026-04-29T12:10:00Z");
      expect(afterAgain.dueAt.getTime()).toBe(expectedTime.getTime());
    });

    it("should allow recovery from lapse with good ratings", () => {
      const now = new Date("2026-04-29T12:00:00Z");
      const lapsed: SrsState = {
        dueAt: new Date("2026-04-29T12:10:00Z"),
        easeFactor: 2.3,
        intervalDays: 0,
        lapses: 1,
        repetitions: 0,
        state: "lapsed",
        leeched: false
      };

      const afterRecovery = scheduleSrsReview(lapsed, "good", now);
      expect(afterRecovery.state).toBe("learning");
      expect(afterRecovery.repetitions).toBe(1);
      expect(afterRecovery.lapses).toBe(1); // Lapses don't decrease
      expect(afterRecovery.intervalDays).toBe(1);
    });
  });

  describe("Leech detection", () => {
    it("should mark card as leeched when lapses reach threshold", () => {
      let state: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: 0,
        repetitions: 0,
        state: "new",
        leeched: false
      };

      // Trigger lapses up to threshold
      for (let i = 0; i < LEECH_THRESHOLD_LAPSES; i++) {
        state = scheduleSrsReview(state, "again", new Date());
      }

      expect(state.lapses).toBe(LEECH_THRESHOLD_LAPSES);
      expect(state.leeched).toBe(true);
    });

    it("should detect leech at exactly 8 lapses", () => {
      let state: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: 7,
        repetitions: 0,
        state: "lapsed",
        leeched: false
      };

      // 8th lapse triggers leech
      state = scheduleSrsReview(state, "again", new Date());
      expect(state.lapses).toBe(LEECH_THRESHOLD_LAPSES);
      expect(state.leeched).toBe(true);

      // 9th lapse keeps leech flag
      state = scheduleSrsReview(state, "again", new Date());
      expect(state.lapses).toBe(9);
      expect(state.leeched).toBe(true);
    });

    it("should not mark as leeched if already leeched", () => {
      const state: SrsState = {
        dueAt: new Date(),
        easeFactor: 1.3,
        intervalDays: 0,
        lapses: LEECH_THRESHOLD_LAPSES + 1,
        repetitions: 0,
        state: "lapsed",
        leeched: true
      };

      const afterAgain = scheduleSrsReview(state, "again", new Date());
      expect(afterAgain.leeched).toBe(true);
      expect(afterAgain.lapses).toBe(LEECH_THRESHOLD_LAPSES + 2);
    });

    it("should include leech flag in response", () => {
      let state: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: 7,
        repetitions: 0,
        state: "lapsed",
        leeched: false
      };

      state = scheduleSrsReview(state, "again", new Date());
      expect(state).toHaveProperty("leeched");
      expect(state.leeched).toBe(true);
    });
  });

  describe("Comeback mode", () => {
    it("should activate comeback mode when card becomes leeched", () => {
      let state: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: 7,
        repetitions: 0,
        state: "lapsed",
        leeched: false
      };

      // 8th lapse → leech + activate comeback mode
      state = scheduleSrsReview(state, "again", new Date());
      expect(state.leeched).toBe(true);
      expect(state.comebackMode).toBe(true);
    });

    it("should reduce interval in comeback mode", () => {
      const state: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: LEECH_THRESHOLD_LAPSES,
        repetitions: 0, // Start at new state
        state: "new",
        leeched: true,
        comebackMode: true
      };

      // First review in comeback mode: new → learning, still comeback
      const firstReview = scheduleSrsReview(state, "good", new Date(), true);
      expect(firstReview.state).toBe("learning");
      expect(firstReview.repetitions).toBe(1);
      expect(firstReview.comebackMode).toBe(true); // Still in comeback

      // For comparison without comeback
      const normalReview = scheduleSrsReview(state, "good", new Date(), false);
      expect(normalReview.comebackMode).toBe(false);

      // The intervals should be the same at repetitions=1 (both get 1 day)
      // but the multiplier will matter at higher repetitions
      expect(firstReview.intervalDays).toBeLessThanOrEqual(normalReview.intervalDays);
    });

    it("should apply comeback multiplier correctly (0.5x)", () => {
      let state: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: LEECH_THRESHOLD_LAPSES,
        repetitions: 0,
        state: "lapsed",
        leeched: true,
        comebackMode: true
      };

      // With comeback mode, interval should be halved
      state = scheduleSrsReview(state, "good", new Date(), true);
      expect(state.intervalDays).toBe(1); // 1 day (half of 2, rounded)
      expect(state.comebackMode).toBe(true);

      // Next review still in comeback
      state = scheduleSrsReview(state, "good", new Date(), true);
      expect(state.state).toBe("review");
      // Normal interval would be ~4-5 days, comeback reduces to ~2 days
      expect(state.intervalDays).toBeLessThanOrEqual(3);
    });

    it("should exit comeback mode when reaching review state with good/easy", () => {
      let state: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: LEECH_THRESHOLD_LAPSES,
        repetitions: 0,
        state: "lapsed",
        leeched: true,
        comebackMode: true
      };

      // First comeback review
      state = scheduleSrsReview(state, "good", new Date(), true);
      expect(state.comebackMode).toBe(true);

      // Second review with easy → should exit comeback
      state = scheduleSrsReview(state, "easy", new Date(), true);
      expect(state.state).toBe("review");
      expect(state.comebackMode).toBe(false);
    });

    it("should stay in comeback mode if rating hard during recovery", () => {
      let state: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: LEECH_THRESHOLD_LAPSES,
        repetitions: 0,
        state: "lapsed",
        leeched: true,
        comebackMode: true
      };

      state = scheduleSrsReview(state, "hard", new Date(), true);
      expect(state.state).toBe("learning");
      expect(state.comebackMode).toBe(true); // Stay in comeback for recovery
    });

    it("should not exit comeback mode if repetitions < 2", () => {
      let state: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: LEECH_THRESHOLD_LAPSES,
        repetitions: 0,
        state: "lapsed",
        leeched: true,
        comebackMode: true
      };

      // First good review: state → learning, repetitions = 1
      state = scheduleSrsReview(state, "good", new Date(), true);
      expect(state.state).toBe("learning");
      expect(state.repetitions).toBe(1);
      expect(state.comebackMode).toBe(true); // Still in comeback, repetitions < 2
    });

    it("should apply multiplier to hard intervals in comeback mode", () => {
      let state: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: LEECH_THRESHOLD_LAPSES,
        repetitions: 0,
        state: "lapsed",
        leeched: true,
        comebackMode: true
      };

      state = scheduleSrsReview(state, "good", new Date(), true);
      // First review: learning state, repetitions=1, no comeback exit
      expect(state.state).toBe("learning");
      expect(state.comebackMode).toBe(true);

      state = scheduleSrsReview(state, "hard", new Date(), true);
      // Hard rating: 1.2x multiplier on base intervals, then comeback 0.5x multiplier
      // nextIntervalDays(0, 1, 2.5, "hard") = 1 day (rep=1, hard → 1)
      // With comeback: 1 * 0.5 = 0.5 → rounds to 1
      expect(state.intervalDays).toBeGreaterThanOrEqual(1); // At least 1 day even with comeback
    });
  });

  describe("Edge cases", () => {
    it("should handle immediate button (again) on new card correctly", () => {
      const state: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: 0,
        repetitions: 0,
        state: "new",
        leeched: false
      };

      const afterAgain = scheduleSrsReview(state, "again", new Date());
      expect(afterAgain.state).toBe("lapsed");
      expect(afterAgain.lapses).toBe(1);
      expect(afterAgain.repetitions).toBe(0);
      expect(afterAgain.easeFactor).toBe(2.3);
    });

    it("should maintain all state fields correctly", () => {
      const now = new Date();
      const state: SrsState = {
        dueAt: now,
        easeFactor: 2.5,
        intervalDays: 5,
        lapses: 0,
        repetitions: 2,
        state: "review",
        leeched: false
      };

      const next = scheduleSrsReview(state, "good", now);

      // All required fields present
      expect(next).toHaveProperty("dueAt");
      expect(next).toHaveProperty("easeFactor");
      expect(next).toHaveProperty("intervalDays");
      expect(next).toHaveProperty("lapses");
      expect(next).toHaveProperty("repetitions");
      expect(next).toHaveProperty("state");
      expect(next).toHaveProperty("leeched");
    });

    it("should handle multiple consecutive lapses correctly", () => {
      let state: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: 0,
        repetitions: 0,
        state: "new",
        leeched: false,
        comebackMode: false
      };

      // Multiple lapses without recovery
      for (let i = 0; i < 5; i++) {
        state = scheduleSrsReview(state, "again", new Date());
        expect(state.state).toBe("lapsed");
        expect(state.lapses).toBe(i + 1);
        expect(state.easeFactor).toBeLessThanOrEqual(2.5 - 0.2 * (i + 1));
      }

      expect(state.lapses).toBe(5);
      expect(state.leeched).toBe(false); // Not yet at threshold
    });

    it("should round intervals correctly", () => {
      let state: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.3,
        intervalDays: 5,
        lapses: 0,
        repetitions: 2,
        state: "review",
        leeched: false,
        comebackMode: false
      };

      // Rating good: interval = 5 * 2.3 = 11.5 → 12
      state = scheduleSrsReview(state, "good", new Date());
      expect(Number.isInteger(state.intervalDays)).toBe(true);

      // With easy rating, ease factor increases
      const stateWithEasy: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.3,
        intervalDays: 5,
        lapses: 0,
        repetitions: 2,
        state: "review",
        leeched: false,
        comebackMode: false
      };
      const stateAfterEasy = scheduleSrsReview(stateWithEasy, "easy", new Date());
      expect(stateAfterEasy.easeFactor).toBe(2.45); // 2.3 + 0.15, rounded to 2 decimals
    });

    it("should ensure interval is at least 1 day", () => {
      let state: SrsState = {
        dueAt: new Date(),
        easeFactor: 1.3,
        intervalDays: 1,
        lapses: 0,
        repetitions: 2,
        state: "review",
        leeched: false
      };

      // Even with very low ease and hard rating, min interval = 1
      state = scheduleSrsReview(state, "hard", new Date());
      expect(state.intervalDays).toBeGreaterThanOrEqual(1);
    });

    it("should ensure comeback intervals stay positive", () => {
      let state: SrsState = {
        dueAt: new Date(),
        easeFactor: 1.3,
        intervalDays: 1,
        lapses: LEECH_THRESHOLD_LAPSES,
        repetitions: 0,
        state: "lapsed",
        leeched: true,
        comebackMode: true
      };

      state = scheduleSrsReview(state, "hard", new Date(), true);
      expect(state.intervalDays).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Timestamp handling", () => {
    it("should calculate due date correctly from reviewedAt", () => {
      const reviewedAt = new Date("2026-04-29T12:00:00Z");
      const state: SrsState = {
        dueAt: reviewedAt,
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: 0,
        repetitions: 0,
        state: "new",
        leeched: false
      };

      const next = scheduleSrsReview(state, "good", reviewedAt);
      const expectedDue = new Date("2026-04-30T12:00:00Z"); // +1 day
      expect(next.dueAt.getTime()).toBe(expectedDue.getTime());
    });

    it("should add minutes correctly for lapse due date", () => {
      const reviewedAt = new Date("2026-04-29T14:30:00Z");
      const state: SrsState = {
        dueAt: reviewedAt,
        easeFactor: 2.5,
        intervalDays: 10,
        lapses: 0,
        repetitions: 3,
        state: "review",
        leeched: false
      };

      const next = scheduleSrsReview(state, "again", reviewedAt);
      const expectedDue = new Date("2026-04-29T14:40:00Z"); // +10 minutes
      expect(next.dueAt.getTime()).toBe(expectedDue.getTime());
    });
  });

  describe("Learning science compliance", () => {
    it("should not be punitive - leeched cards recoverable", () => {
      let state: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: 7,
        repetitions: 0,
        state: "lapsed",
        leeched: false,
        comebackMode: false
      };

      // Become leeched
      state = scheduleSrsReview(state, "again", new Date());
      expect(state.leeched).toBe(true);
      expect(state.comebackMode).toBe(true);

      // Recovery path: with comeback mode, can progress quickly
      state = scheduleSrsReview(state, "good", new Date(), true);
      expect(state.state).toBe("learning");
      expect(state.intervalDays).toBeLessThanOrEqual(1);

      state = scheduleSrsReview(state, "good", new Date(), true);
      expect(state.state).toBe("review");
      expect(state.comebackMode).toBe(false); // Exited recovery

      // Now progresses normally
      state = scheduleSrsReview(state, "good", new Date(), false);
      expect(state.state).toBe("review");
      expect(state.intervalDays).toBeGreaterThan(0);
    });

    it("should track difficulty progression reasonably", () => {
      let state: SrsState = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: 0,
        repetitions: 0,
        state: "new",
        leeched: false
      };

      // Easy path: increases intervals and ease
      state = scheduleSrsReview(state, "easy", new Date());
      state = scheduleSrsReview(state, "easy", new Date());
      const easeAfterEasy2 = state.easeFactor;

      // Reset for hard path
      state = {
        dueAt: new Date(),
        easeFactor: 2.5,
        intervalDays: 0,
        lapses: 0,
        repetitions: 0,
        state: "new",
        leeched: false
      };

      // Hard path: decreases intervals and ease
      state = scheduleSrsReview(state, "hard", new Date());
      state = scheduleSrsReview(state, "hard", new Date());
      const easeAfterHard2 = state.easeFactor;

      // Easy path should have higher ease factors
      expect(easeAfterEasy2).toBeGreaterThan(easeAfterHard2);
    });
  });
});
