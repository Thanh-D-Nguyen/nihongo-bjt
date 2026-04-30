import { describe, expect, it, vi } from "vitest";

const prismaMock = {
  quizAnswer: {
    findMany: vi.fn()
  },
  quizSession: {
    findMany: vi.fn()
  },
  reviewEvent: {
    findMany: vi.fn()
  }
};

vi.mock("@nihongo-bjt/database", () => ({
  createPrismaClient: () => prismaMock
}));

import { AnalyticsRepository } from "./analytics.repository.js";

describe("AnalyticsRepository learner weak skills", () => {
  it("returns high-failure skill tags from real quiz answers", async () => {
    prismaMock.reviewEvent.findMany.mockResolvedValue([
      { rating: "again", reviewedAt: new Date("2026-04-30T00:00:00.000Z") }
    ]);
    prismaMock.quizSession.findMany.mockResolvedValue([
      {
        completedAt: new Date("2026-04-30T00:00:00.000Z"),
        estimatedBjtBand: "J4",
        estimatedScore: 420,
        status: "completed"
      }
    ]);
    prismaMock.quizAnswer.findMany
      .mockResolvedValueOnce([
        { answeredAt: new Date("2026-04-30T00:00:00.000Z"), isCorrect: false },
        { answeredAt: new Date("2026-04-30T00:01:00.000Z"), isCorrect: true },
        { answeredAt: new Date("2026-04-30T00:02:00.000Z"), isCorrect: false }
      ])
      .mockResolvedValueOnce([
        { isCorrect: false, question: { skillTag: "listening.detail" } },
        { isCorrect: false, question: { skillTag: "listening.detail" } },
        { isCorrect: true, question: { skillTag: "listening.detail" } },
        { isCorrect: false, question: { skillTag: "grammar.form" } },
        { isCorrect: true, question: { skillTag: "grammar.form" } },
        { isCorrect: true, question: { skillTag: "grammar.form" } }
      ]);

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
