import { describe, expect, it } from "vitest";

import { shouldHideVocabularyMeanings } from "./reading-exam.guard.js";

describe("shouldHideVocabularyMeanings", () => {
  it("hides in timed bjt when answer not submitted", () => {
    expect(
      shouldHideVocabularyMeanings({ kind: "bjt_quiz", mode: "timed", answerSubmitted: false })
    ).toBe(true);
    expect(shouldHideVocabularyMeanings({ kind: "bjt_quiz", mode: "timed" })).toBe(true);
  });

  it("allows in practice bjt", () => {
    expect(shouldHideVocabularyMeanings({ kind: "bjt_quiz", mode: "practice" })).toBe(false);
  });

  it("allows in timed bjt after submit", () => {
    expect(
      shouldHideVocabularyMeanings({ kind: "bjt_quiz", mode: "timed", answerSubmitted: true })
    ).toBe(false);
  });

  it("no exam context: allow", () => {
    expect(shouldHideVocabularyMeanings(undefined)).toBe(false);
  });
});
