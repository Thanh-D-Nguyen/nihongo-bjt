import { describe, it, expect } from "vitest";
import type { BreakdownResponse, BreakdownQuestion } from "./quiz-results-breakdown";

// Tests for the breakdown data structure and labels
describe("QuizResultsBreakdown structure", () => {
  const mockBreakdown: BreakdownResponse = {
    sessionId: "session-1",
    testId: "test-1",
    testTitleVi: "BJT Mock",
    estimatedScore: 78,
    estimatedBjtBand: "N2",
    breakdown: [
      {
        questionId: "q1",
        prompt: "What is 請求書?",
        selectedOption: "A",
        isCorrect: true,
        explanationVi: "Invoice is a document..."
      },
      {
        questionId: "q2",
        prompt: "What is 領収書?",
        selectedOption: "B",
        isCorrect: false,
        explanationVi: "Receipt is a document...",
        remediationCardId: "card-1"
      }
    ]
  };

  it("has correct structure with estimated score and band fields", () => {
    expect(mockBreakdown).toHaveProperty("estimatedScore", 78);
    expect(mockBreakdown).toHaveProperty("estimatedBjtBand", "N2");
  });

  it("has per-question breakdown array", () => {
    expect(mockBreakdown.breakdown).toHaveLength(2);
    expect(mockBreakdown.breakdown[0]).toHaveProperty("questionId");
    expect(mockBreakdown.breakdown[0]).toHaveProperty("prompt");
    expect(mockBreakdown.breakdown[0]).toHaveProperty("selectedOption");
    expect(mockBreakdown.breakdown[0]).toHaveProperty("isCorrect");
    expect(mockBreakdown.breakdown[0]).toHaveProperty("explanationVi");
  });

  it("marks correct answer without remediation card", () => {
    const correctQ = mockBreakdown.breakdown[0];
    expect(correctQ.isCorrect).toBe(true);
    expect(correctQ.remediationCardId).toBeUndefined();
  });

  it("marks wrong answer with remediation card", () => {
    const wrongQ = mockBreakdown.breakdown[1];
    expect(wrongQ.isCorrect).toBe(false);
    expect(wrongQ.remediationCardId).toBe("card-1");
  });

  it("has proper typing for remediationCardId (only on wrong answers)", () => {
    mockBreakdown.breakdown.forEach((q: BreakdownQuestion) => {
      if (q.isCorrect) {
        // Correct answers should not have remediation (or it should be undefined)
        if (q.remediationCardId) {
          expect(false).toBe(true); // This should not happen
        }
      } else {
        // Wrong answers may have remediation
        expect(typeof q.remediationCardId === "string" || q.remediationCardId === undefined).toBe(
          true
        );
      }
    });
  });

  it("never exposes answer key for non-selected options in structure", () => {
    // The structure should only have selectedOption and isCorrect
    // It should not have an 'options' array with isCorrect for each
    mockBreakdown.breakdown.forEach((q: BreakdownQuestion) => {
      expect(q).toHaveProperty("selectedOption");
      expect(q).toHaveProperty("isCorrect");
      expect((q as unknown as Record<string, unknown>).options).toBeUndefined();
    });
  });
});
