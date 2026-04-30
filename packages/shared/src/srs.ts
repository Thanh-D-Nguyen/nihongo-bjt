import { z } from "zod";

export const srsRatingSchema = z.enum(["again", "hard", "good", "easy"]);
export type SrsRating = z.infer<typeof srsRatingSchema>;

export interface SrsState {
  dueAt: Date;
  easeFactor: number;
  intervalDays: number;
  lapses: number;
  repetitions: number;
  state: "new" | "learning" | "review" | "lapsed";
  leeched?: boolean;
  comebackMode?: boolean;
}

/**
 * **Leech thresholds:**
 * - Standard: lapses >= 8 indicates a card is fundamentally difficult ("leeched")
 * - Learners should focus on understanding over memorization for leeched cards
 * - Comeback mode reduces starting intervals to accelerate recovery
 */
export const LEECH_THRESHOLD_LAPSES = 8;

/**
 * **Comeback mode:**
 * - Triggered when a leeched card is reviewed after the card was marked leeched
 * - Applies a reduced interval multiplier to accelerate recovery
 * - Once card reaches review state with comeback mode, gradually normalize intervals
 */
export const COMEBACK_MODE_INTERVAL_MULTIPLIER = 0.5;

/**
 * Pure **SM-2–style** scheduling with leech detection and comeback mode.
 *
 * **Leech detection:**
 * - When lapses reach LEECH_THRESHOLD_LAPSES, mark card as leeched
 * - Leeched cards indicate persistent difficulty; learner should review understanding
 *
 * **Comeback mode:**
 * - Reduces interval multiplier to 50% to accelerate re-engagement after leech detection
 * - Helps learners recover without feeling punished
 *
 * **Invariant:** do not re-seed `reviewedAt` or ratings inside this function; idempotency is enforced by the API
 * layer (e.g. one update per `userFlashcardId` per request), not here.
 */
export function scheduleSrsReview(
  current: SrsState,
  rating: SrsRating,
  reviewedAt: Date,
  comebackMode?: boolean
): SrsState {
  if (rating === "again") {
    const newLapses = current.lapses + 1;
    const isLeechedAfterReview = newLapses >= LEECH_THRESHOLD_LAPSES;

    return {
      comebackMode: isLeechedAfterReview ? true : comebackMode,
      dueAt: addMinutes(reviewedAt, 10),
      easeFactor: Math.max(1.3, current.easeFactor - 0.2),
      intervalDays: 0,
      lapses: newLapses,
      leeched: isLeechedAfterReview ? true : current.leeched ?? false,
      repetitions: 0,
      state: "lapsed"
    };
  }

  const easeDelta = rating === "hard" ? -0.15 : rating === "easy" ? 0.15 : 0;
  const easeFactor = roundEase(Math.max(1.3, current.easeFactor + easeDelta));
  const repetitions = current.repetitions + 1;
  const baseIntervalDays = nextIntervalDays(current.intervalDays, repetitions, easeFactor, rating);

  // Apply comeback mode multiplier if card is in comeback recovery
  const intervalDays = comebackMode
    ? Math.max(1, Math.round(baseIntervalDays * COMEBACK_MODE_INTERVAL_MULTIPLIER))
    : baseIntervalDays;

  // Exit comeback mode once card reaches review state with good/easy ratings
  const exitComebackMode = comebackMode && repetitions >= 2 && rating !== "hard";

  return {
    comebackMode: exitComebackMode ? false : comebackMode ?? false,
    dueAt: addDays(reviewedAt, intervalDays),
    easeFactor,
    intervalDays,
    lapses: current.lapses,
    leeched: current.leeched ?? false,
    repetitions,
    state: repetitions >= 2 ? "review" : "learning"
  };
}

function nextIntervalDays(
  currentIntervalDays: number,
  repetitions: number,
  easeFactor: number,
  rating: Exclude<SrsRating, "again">
) {
  if (repetitions === 1) {
    return rating === "easy" ? 3 : 1;
  }

  if (repetitions === 2) {
    return rating === "hard" ? 3 : rating === "easy" ? 7 : 4;
  }

  const multiplier = rating === "hard" ? 1.2 : rating === "easy" ? easeFactor + 0.5 : easeFactor;
  return Math.max(1, Math.round(currentIntervalDays * multiplier));
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

function roundEase(value: number) {
  return Math.round(value * 100) / 100;
}
