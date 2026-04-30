export type BjtReadingExamContext = {
  answerSubmitted?: boolean;
  kind: "bjt_quiz";
  mode: "practice" | "timed";
};

/**
 * **BJT 読解 / quiz fairness:** in **timed** mode, dictionary “meanings” must not be shown until
 * `answerSubmitted` is true, so 読解 (reading comprehension) is not a lookup exercise. `practice` always allows hints.
 * Cached token analysis is exam-agnostic; `ReadingAssistService` applies `applyExamStrip` when serving results.
 */
export function shouldHideVocabularyMeanings(exam: BjtReadingExamContext | undefined): boolean {
  if (!exam || exam.kind !== "bjt_quiz") {
    return false;
  }
  if (exam.mode === "practice") {
    return false;
  }
  if (exam.mode === "timed" && exam.answerSubmitted === true) {
    return false;
  }
  return true;
}
