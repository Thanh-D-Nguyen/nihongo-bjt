import { describe, expect, it, vi } from "vitest";

const prismaMock = {
  learningPath: {
    findMany: vi.fn()
  },
  quizAnswer: {
    findMany: vi.fn()
  },
  quizSession: {
    findMany: vi.fn()
  },
  reviewEvent: {
    findMany: vi.fn()
  },
  userFlashcard: {
    count: vi.fn()
  }
};

vi.mock("@nihongo-bjt/database", () => ({
  createPrismaClient: () => prismaMock
}));

import { AnalyticsRepository } from "./analytics.repository.js";

describe("AnalyticsRepository learner weak skills", () => {
  it("returns high-failure skill tags from real quiz answers", async () => {
    const reviewRows = [{ rating: "again", reviewedAt: new Date("2026-04-30T00:00:00.000Z") }];
    const sessionRows = [
      { completedAt: new Date("2026-04-30T00:00:00.000Z"), estimatedBjtBand: "J4", estimatedScore: 420, status: "completed" }
    ];
    const answerRows = [
      { answeredAt: new Date("2026-04-30T00:00:00.000Z"), isCorrect: false },
      { answeredAt: new Date("2026-04-30T00:01:00.000Z"), isCorrect: true },
      { answeredAt: new Date("2026-04-30T00:02:00.000Z"), isCorrect: false }
    ];
    const answersBySkill = [
      { isCorrect: false, question: { skillTag: "listening.detail" } },
      { isCorrect: false, question: { skillTag: "listening.detail" } },
      { isCorrect: true, question: { skillTag: "listening.detail" } },
      { isCorrect: false, question: { skillTag: "grammar.form" } },
      { isCorrect: true, question: { skillTag: "grammar.form" } },
      { isCorrect: true, question: { skillTag: "grammar.form" } }
    ];

    prismaMock.reviewEvent.findMany
      .mockResolvedValueOnce(reviewRows)
      .mockResolvedValueOnce(reviewRows);
    prismaMock.quizSession.findMany
      .mockResolvedValueOnce(sessionRows)
      .mockResolvedValueOnce(sessionRows);
    prismaMock.quizAnswer.findMany
      .mockResolvedValueOnce(answerRows)
      .mockResolvedValueOnce(answersBySkill)
      .mockResolvedValueOnce(answerRows);
    prismaMock.userFlashcard.count.mockResolvedValueOnce(4);
    prismaMock.learningPath.findMany.mockResolvedValueOnce([]);

    const repo = new AnalyticsRepository();
    const result = await repo.learner(7, "11111111-1111-4111-8111-111111111111");

    expect(result.weakSkills).toEqual([
      {
        attempts: 3,
        failureRate: 66.7,
        incorrect: 2,
        skillTag: "listening.detail"
      }
    ]);
  });
});
