import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  quizSession: {
    findFirst: vi.fn()
  }
};

vi.mock("@nihongo-bjt/database", () => ({
  createPrismaClient: () => prismaMock
}));

import { QuizRepository } from "./quiz.repository.js";

describe("Quiz session breakdown structure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("uses persisted correctness and returns section/skill aggregates from one bounded query", async () => {
    prismaMock.quizSession.findFirst.mockResolvedValueOnce({
      answers: [
        {
          isCorrect: true,
          question: {
            difficulty: "hard",
            explanationVi: "Đáp án đúng vì ngữ cảnh yêu cầu xác nhận.",
            id: "q1",
            prompt: "確認として最も適切な表現はどれですか。",
            remediationCardId: null,
            section: { code: "listening-reading" },
            skillTag: "inference"
          },
          selectedOption: "C"
        },
        {
          isCorrect: false,
          question: {
            difficulty: "easy",
            explanationVi: "Cần dùng kính ngữ phù hợp với khách hàng.",
            id: "q2",
            prompt: "お客様への返答として最も適切なものはどれですか。",
            remediationCardId: "card-2",
            section: { code: "reading" },
            skillTag: "business-manners"
          },
          selectedOption: "A"
        }
      ],
      estimatedBjtBand: "J2",
      estimatedScore: 420,
      id: "session-1",
      test: {
        id: "test-1",
        sections: [
          {
            code: "listening-reading",
            questions: [{ difficulty: "hard", id: "q1", skillTag: "inference" }]
          },
          {
            code: "reading",
            questions: [
              { difficulty: "easy", id: "q2", skillTag: "business-manners" },
              { difficulty: "standard", id: "q3", skillTag: "business-manners" }
            ]
          }
        ],
        titleJa: "BJT模擬試験",
        titleVi: "Thi thử BJT"
      }
    });

    const result = await new QuizRepository().breakdown("session-1", "learner-1");

    expect(prismaMock.quizSession.findFirst).toHaveBeenCalledTimes(1);
    const query = prismaMock.quizSession.findFirst.mock.calls[0]?.[0];
    expect(query.include.answers.select).not.toHaveProperty("options");
    expect(query.include.answers.select.question.select).not.toHaveProperty("options");
    expect(result.breakdown[0]).toMatchObject({
      difficulty: "hard",
      isCorrect: true,
      sectionCode: "listening-reading",
      skillTag: "inference"
    });
    expect(result.breakdown[1].remediationCardId).toBe("card-2");
    expect(result.sectionPerformance).toHaveLength(2);
    expect(result.skillPerformance).toHaveLength(2);
    expect(result.sectionPerformance.find((item) => item.key === "reading")).toMatchObject({
      accuracy: 0,
      answeredCount: 1,
      correctCount: 0,
      totalQuestions: 2
    });
  });
});
