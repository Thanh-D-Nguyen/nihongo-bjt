import { describe, expect, it } from "vitest";

import { COMPANION_DUE_BACKLOG_THRESHOLD, rankCompanionHint } from "./companion-hint.scoring.js";

const baseInput = {
  bjtAccuracyPct: 70,
  dueCount: 0,
  flashcardRemaining: 20,
  hoursSinceLastBattle: 24,
  hoursSinceLastQuiz: 24,
  hoursSinceLastReview: 24,
  quizAnswerCount: 10,
  reviewCount: 10,
  streakDays: 0,
  weakSkills: [] as { failureRate: number; skillTag: string }[]
};

describe("rankCompanionHint", () => {
  it("prioritizes SRS when many cards are due and quota remains", () => {
    const { primary } = rankCompanionHint({
      ...baseInput,
      dueCount: COMPANION_DUE_BACKLOG_THRESHOLD + 3,
      flashcardRemaining: 12,
      streakDays: 2
    });
    expect(primary.action).toBe("srs_review");
    expect(primary.reasons[0]?.code).toBe("SRS_QUEUE_BACKLOG");
  });

  it("surfaces BJT when flashcard quota is exhausted but reviews are due", () => {
    const { primary } = rankCompanionHint({
      ...baseInput,
      dueCount: 8,
      flashcardRemaining: 0,
      weakSkills: []
    });
    expect(primary.action).toBe("bjt_quiz");
    expect(primary.reasons[0]?.code).toBe("FLASHCARD_QUOTA_EXHAUSTED_FALLBACK");
  });

  it("prefers quiz remediation when weak skills are strong signal", () => {
    const { primary } = rankCompanionHint({
      ...baseInput,
      dueCount: 0,
      flashcardRemaining: 10,
      weakSkills: [
        { failureRate: 85, skillTag: "keigo.email" },
        { failureRate: 72, skillTag: "listening.detail" }
      ]
    });
    expect(primary.action).toBe("bjt_quiz");
    expect(primary.reasons[0]?.code).toBe("QUIZ_WEAK_SKILLS");
  });
});
