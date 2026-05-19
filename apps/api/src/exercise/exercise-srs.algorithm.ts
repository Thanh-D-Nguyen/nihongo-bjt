/**
 * SM-2 Spaced Repetition Algorithm for Exercise Review.
 *
 * Based on the SuperMemo SM-2 algorithm with minor adjustments:
 * - Ratings: again (0), hard (1), good (2), easy (3)
 * - New cards: steps of 1min, 10min before graduating
 * - Graduate interval: 1 day
 * - Easy bonus: 1.3x multiplier
 */

export type ExerciseRating = "again" | "hard" | "good" | "easy";

export interface SrsState {
  state: "new" | "learning" | "review" | "graduated";
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: Date;
}

export interface SrsUpdate {
  state: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: Date;
}

const MIN_EASE = 1.3;
const EASY_BONUS = 1.3;
const GRADUATING_INTERVAL = 1;
const EASY_INTERVAL = 4;

export function computeNextReview(current: SrsState, rating: ExerciseRating): SrsUpdate {
  let { easeFactor, intervalDays, repetitions, lapses } = current;
  let state = current.state;
  let dueAt: Date;

  switch (rating) {
    case "again":
      // Lapse: reset to learning
      lapses += 1;
      repetitions = 0;
      intervalDays = 0;
      state = "learning";
      // Review again in 1 minute (for immediate re-learn)
      dueAt = addMinutes(new Date(), 1);
      // Decrease ease factor
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.2);
      break;

    case "hard":
      if (state === "new" || state === "learning") {
        // Stay in learning, review in 10 minutes
        state = "learning";
        dueAt = addMinutes(new Date(), 10);
      } else {
        // Multiply interval by 1.2 (harder = shorter next interval)
        intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
        dueAt = addDays(new Date(), intervalDays);
        easeFactor = Math.max(MIN_EASE, easeFactor - 0.15);
      }
      break;

    case "good":
      if (state === "new" || state === "learning") {
        // Graduate to review
        state = "graduated";
        intervalDays = GRADUATING_INTERVAL;
        repetitions = 1;
        dueAt = addDays(new Date(), intervalDays);
      } else {
        // Standard SM-2 progression
        repetitions += 1;
        if (repetitions === 1) {
          intervalDays = 1;
        } else if (repetitions === 2) {
          intervalDays = 6;
        } else {
          intervalDays = Math.round(intervalDays * easeFactor);
        }
        state = "graduated";
        dueAt = addDays(new Date(), intervalDays);
      }
      break;

    case "easy":
      // Immediately graduate with bonus interval
      state = "graduated";
      repetitions += 1;
      if (current.state === "new" || current.state === "learning") {
        intervalDays = EASY_INTERVAL;
      } else {
        intervalDays = Math.round(intervalDays * easeFactor * EASY_BONUS);
      }
      easeFactor = easeFactor + 0.15;
      dueAt = addDays(new Date(), intervalDays);
      break;
  }

  return { state, easeFactor, intervalDays, repetitions, lapses, dueAt };
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
