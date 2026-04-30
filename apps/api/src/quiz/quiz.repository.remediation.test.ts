import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  bjtQuestionOption: {
    findFirst: vi.fn()
  },
  quizAnswer: {
    count: vi.fn()
  },
  quizSession: {
    findFirst: vi.fn()
  },
  $transaction: vi.fn()
};

vi.mock("@nihongo-bjt/database", () => ({
  createPrismaClient: () => prismaMock
}));

import { QuizRepository } from "./quiz.repository.js";

describe("QuizRepository remediation mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns remediationCardId when a wrong answer has mapping", async () => {
    const repo = new QuizRepository();
    const answeredAt = new Date("2026-04-29T10:00:00.000Z");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(answeredAt.getTime());

    prismaMock.quizSession.findFirst.mockResolvedValueOnce({
      correctCount: 0,
      id: "session-1",
      startedAt: new Date(answeredAt.getTime() - 1_000),
      test: { timeLimitSeconds: 60 },
      totalQuestions: 4
    });
    prismaMock.bjtQuestionOption.findFirst.mockResolvedValueOnce({
      isCorrect: false,
      question: { remediationCardId: "card-1" }
    });
    prismaMock.quizAnswer.count.mockResolvedValueOnce(0);
    prismaMock.$transaction.mockImplementationOnce(async (callback) =>
      callback({
        analyticsEvent: {
          create: vi.fn().mockResolvedValue(undefined)
        },
        quizAnswer: {
          create: vi.fn().mockResolvedValue({
            answeredAt,
            id: "answer-1",
            questionId: "question-1",
            selectedOption: "B",
            sessionId: "session-1"
          })
        },
        quizSession: {
          update: vi.fn().mockResolvedValue({
            correctCount: 0,
            currentQuestionNo: 1,
            id: "session-1",
            status: "in_progress",
            totalQuestions: 4
          })
        }
      })
    );

    await expect(
      repo.submitAnswer({
        optionKey: "B",
        questionId: "question-1",
        sessionId: "session-1",
        userId: "22222222-2222-4222-8222-222222222222"
      })
    ).resolves.toMatchObject({
      remediationCardId: "card-1",
      session: { status: "in_progress" }
    });

    nowSpy.mockRestore();
  });

  it("does not return remediationCardId for correct answers", async () => {
    const repo = new QuizRepository();
    const answeredAt = new Date("2026-04-29T10:00:00.000Z");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(answeredAt.getTime());

    prismaMock.quizSession.findFirst.mockResolvedValueOnce({
      correctCount: 0,
      id: "session-1",
      startedAt: new Date(answeredAt.getTime() - 1_000),
      test: { timeLimitSeconds: 60 },
      totalQuestions: 4
    });
    prismaMock.bjtQuestionOption.findFirst.mockResolvedValueOnce({
      isCorrect: true,
      question: { remediationCardId: "card-1" }
    });
    prismaMock.quizAnswer.count.mockResolvedValueOnce(0);
    prismaMock.$transaction.mockImplementationOnce(async (callback) =>
      callback({
        analyticsEvent: {
          create: vi.fn().mockResolvedValue(undefined)
        },
        quizAnswer: {
          create: vi.fn().mockResolvedValue({
            answeredAt,
            id: "answer-1",
            questionId: "question-1",
            selectedOption: "A",
            sessionId: "session-1"
          })
        },
        quizSession: {
          update: vi.fn().mockResolvedValue({
            correctCount: 1,
            currentQuestionNo: 1,
            id: "session-1",
            status: "in_progress",
            totalQuestions: 4
          })
        }
      })
    );

    const result = await repo.submitAnswer({
      optionKey: "A",
      questionId: "question-1",
      sessionId: "session-1",
      userId: "22222222-2222-4222-8222-222222222222"
    });

    expect(result).not.toHaveProperty("remediationCardId");
    nowSpy.mockRestore();
  });

  it("lists wrong-answer remediation cards for a completed session", async () => {
    const repo = new QuizRepository();

    prismaMock.quizSession.findFirst.mockResolvedValueOnce({
      answers: [
        {
          question: {
            id: "question-1",
            remediationCard: {
              backText: "invoice",
              frontText: "請求書",
              id: "card-1",
              reading: "せいきゅうしょ",
              sourceId: "source-1",
              sourceType: "lexeme"
            },
            remediationCardId: "card-1"
          }
        }
      ]
    });

    await expect(
      repo.remediation(
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222"
      )
    ).resolves.toEqual([
      {
        card: {
          backText: "invoice",
          frontText: "請求書",
          id: "card-1",
          reading: "せいきゅうしょ",
          sourceId: "source-1",
          sourceType: "lexeme"
        },
        questionId: "question-1",
        remediationCardId: "card-1"
      }
    ]);
  });

  it("returns empty remediation list when no wrong answers are mapped", async () => {
    const repo = new QuizRepository();

    prismaMock.quizSession.findFirst.mockResolvedValueOnce({
      answers: []
    });

    await expect(
      repo.remediation(
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222"
      )
    ).resolves.toEqual([]);
  });

  it("rejects remediation lookup when completed session is not found", async () => {
    const repo = new QuizRepository();

    prismaMock.quizSession.findFirst.mockResolvedValueOnce(null);

    await expect(
      repo.remediation(
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222"
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
