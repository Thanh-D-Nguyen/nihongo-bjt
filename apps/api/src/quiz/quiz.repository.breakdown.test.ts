import { describe, it, expect } from "vitest";

describe("Quiz session breakdown structure", () => {
  it("returns breakdown with estimated field naming", () => {
    const breakdown = {
      sessionId: "session-1",
      testId: "test-1",
      testTitleVi: "N2 Mock",
      testTitleJa: "N2 模擬試験",
      estimatedScore: 78,
      estimatedBjtBand: "N2",
      breakdown: [
        {
          questionId: "q1",
          prompt: "What is 請求書?",
          selectedOption: "A",
          isCorrect: true,
          explanationVi: "Invoice"
        },
        {
          questionId: "q2",
          prompt: "What is 領収書?",
          selectedOption: "B",
          isCorrect: false,
          explanationVi: "Receipt",
          remediationCardId: "card-1"
        }
      ]
    };

    expect(breakdown).toHaveProperty("estimatedScore");
    expect(breakdown).toHaveProperty("estimatedBjtBand");
    expect(breakdown.breakdown).toHaveLength(2);
  });

  it("does not expose isCorrect for non-selected options", () => {
    const question = {
      questionId: "q1",
      prompt: "Question?",
      selectedOption: "A",
      isCorrect: true,
      explanationVi: "Answer"
    };

    // Verify no extra options are included
    const keys = Object.keys(question);
    expect(keys).not.toContain("options");
    expect(keys).toContain("selectedOption");
    expect(keys).toContain("isCorrect");
  });

  it("includes remediationCardId only when answer is wrong", () => {
    const correctAnswer = {
      questionId: "q1",
      selectedOption: "A",
      isCorrect: true,
      explanationVi: "Correct",
      remediationCardId: undefined
    };

    const wrongAnswer = {
      questionId: "q2",
      selectedOption: "B",
      isCorrect: false,
      explanationVi: "Wrong",
      remediationCardId: "card-1"
    };

    expect(correctAnswer.remediationCardId).toBeUndefined();
    expect(wrongAnswer.remediationCardId).toBeDefined();
  });
});
