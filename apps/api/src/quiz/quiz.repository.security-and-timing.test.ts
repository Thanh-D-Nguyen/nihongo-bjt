import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  bjtMockTest: {
    findFirst: vi.fn()
  },
  bjtQuestionOption: {
    findFirst: vi.fn()
  },
  quizAnswer: {
    count: vi.fn()
  },
  quizSession: {
    findFirst: vi.fn(),
    update: vi.fn()
  },
  $transaction: vi.fn()
};

vi.mock("@nihongo-bjt/database", () => ({
  createPrismaClient: () => prismaMock
}));

import { QuizRepository } from "./quiz.repository.js";

describe("QuizRepository security and timed exam integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not expose isCorrect in currentQuestion options", async () => {
    const repo = new QuizRepository();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-04-29T00:00:01.000Z"));

    prismaMock.quizSession.findFirst.mockResolvedValueOnce({
      answers: [],
      correctCount: 0,
      currentQuestionNo: 0,
      id: "session-1",
      startedAt: new Date("2026-04-29T00:00:00.000Z"),
      status: "in_progress",
      test: {
        timeLimitSeconds: 60,
        sections: [
          {
            questions: [
              {
                createdAt: new Date("2026-04-29T00:00:00.000Z"),
                difficulty: "standard",
                explanationVi: "secret explanation",
                id: "question-1",
                options: [
                  {
                    createdAt: new Date("2026-04-29T00:00:00.000Z"),
                    id: "option-1",
                    isCorrect: true,
                    optionKey: "A",
                    questionId: "question-1",
                    text: "Correct option"
                  },
                  {
                    createdAt: new Date("2026-04-29T00:00:00.000Z"),
                    id: "option-2",
                    isCorrect: false,
                    optionKey: "B",
                    questionId: "question-1",
                    text: "Wrong option"
                  }
                ],
                prompt: "Q1",
                scenario: null,
                skillTag: "reading",
                sourceId: null,
                sourceType: null,
                updatedAt: new Date("2026-04-29T00:00:00.000Z")
              }
            ]
          }
        ]
      },
      totalQuestions: 1
    });

    const result = await repo.currentQuestion(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222"
    );

    expect(result.question?.options).toHaveLength(2);
    expect(result.question?.options[0]).not.toHaveProperty("isCorrect");
    expect(result.question?.options[1]).not.toHaveProperty("isCorrect");
    expect(result.question).not.toHaveProperty("explanationVi");
    expect(result.session).not.toHaveProperty("test");
    expect(result.session).toEqual({
      correctCount: 0,
      currentQuestionNo: 0,
      id: "session-1",
      remainingSeconds: expect.any(Number),
      startedAt: "2026-04-29T00:00:00.000Z",
      status: "in_progress",
      timeLimitSeconds: 60,
      totalQuestions: 1
    });
    nowSpy.mockRestore();
  });

  it("sanitizes template option query to avoid isCorrect exposure", async () => {
    const repo = new QuizRepository();

    prismaMock.bjtMockTest.findFirst.mockResolvedValueOnce(null);

    await repo.template("11111111-1111-4111-8111-111111111111");

    expect(prismaMock.bjtMockTest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          sections: expect.objectContaining({
            include: expect.objectContaining({
              questions: expect.objectContaining({
                select: expect.objectContaining({
                  createdAt: true,
                  difficulty: true,
                  id: true,
                  options: expect.objectContaining({
                    select: expect.objectContaining({
                      createdAt: true,
                      id: true,
                      optionKey: true,
                      questionId: true,
                      text: true
                    })
                  }),
                  prompt: true,
                  scenario: true,
                  skillTag: true,
                  sourceId: true,
                  sourceType: true,
                  updatedAt: true
                })
              })
            })
          })
        })
      })
    );
  });

  it("auto-expires currentQuestion at exact expiry boundary without returning a question", async () => {
    const repo = new QuizRepository();
    const baseNow = 2_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(baseNow + 60_000);

    prismaMock.quizSession.findFirst.mockResolvedValueOnce({
      answers: [],
      correctCount: 0,
      currentQuestionNo: 0,
      id: "session-1",
      startedAt: new Date(baseNow),
      status: "in_progress",
      test: {
        sections: [],
        timeLimitSeconds: 60
      },
      totalQuestions: 1
    });
    prismaMock.quizSession.findFirst.mockResolvedValueOnce({
      correctCount: 0,
      currentQuestionNo: 0,
      estimatedBjtBand: "J5",
      estimatedScore: 0
    });
    prismaMock.quizAnswer.count.mockResolvedValueOnce(0);
    prismaMock.$transaction.mockImplementationOnce(async (callback) =>
      callback({
        analyticsEvent: {
          create: vi.fn().mockResolvedValue(undefined)
        },
        quizSession: {
          update: vi.fn().mockResolvedValue(undefined)
        }
      })
    );

    const result = await repo.currentQuestion(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222"
    );

    expect(result.question).toBeNull();
    expect(result.session.status).toBe("completed");
    expect(result.session.remainingSeconds).toBe(0);

    nowSpy.mockRestore();
  });

  it("auto-expires submitAnswer when timed session has expired without accepting the answer", async () => {
    const repo = new QuizRepository();

    prismaMock.quizSession.findFirst.mockResolvedValueOnce({
      correctCount: 0,
      id: "session-1",
      startedAt: new Date(Date.now() - 61_000),
      test: { timeLimitSeconds: 60 },
      totalQuestions: 10
    });
    prismaMock.quizSession.findFirst.mockResolvedValueOnce({
      correctCount: 0,
      currentQuestionNo: 0,
      estimatedBjtBand: "J5",
      estimatedScore: 0
    });
    prismaMock.quizAnswer.count.mockResolvedValueOnce(0);
    prismaMock.$transaction.mockImplementationOnce(async (callback) =>
      callback({
        analyticsEvent: {
          create: vi.fn().mockResolvedValue(undefined)
        },
        quizSession: {
          update: vi.fn().mockResolvedValue(undefined)
        }
      })
    );

    const result = await repo.submitAnswer({
      optionKey: "A",
      questionId: "question-1",
      sessionId: "session-1",
      userId: "22222222-2222-4222-8222-222222222222"
    });

    expect(result.answer).toBeNull();
    expect(result.session.status).toBe("completed");
    expect(prismaMock.bjtQuestionOption.findFirst).not.toHaveBeenCalled();
  });

  it("auto-expires submitAnswer at exact expiry boundary without accepting the answer", async () => {
    const repo = new QuizRepository();
    const baseNow = 1_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(baseNow + 60_000);

    prismaMock.quizSession.findFirst.mockResolvedValueOnce({
      correctCount: 0,
      id: "session-1",
      startedAt: new Date(baseNow),
      test: { timeLimitSeconds: 60 },
      totalQuestions: 10
    });
    prismaMock.quizSession.findFirst.mockResolvedValueOnce({
      correctCount: 0,
      currentQuestionNo: 0,
      estimatedBjtBand: "J5",
      estimatedScore: 0
    });
    prismaMock.quizAnswer.count.mockResolvedValueOnce(0);
    prismaMock.$transaction.mockImplementationOnce(async (callback) =>
      callback({
        analyticsEvent: {
          create: vi.fn().mockResolvedValue(undefined)
        },
        quizSession: {
          update: vi.fn().mockResolvedValue(undefined)
        }
      })
    );

    const result = await repo.submitAnswer({
      optionKey: "A",
      questionId: "question-1",
      sessionId: "session-1",
      userId: "22222222-2222-4222-8222-222222222222"
    });

    expect(result.answer).toBeNull();
    expect(result.session.status).toBe("completed");
    expect(prismaMock.bjtQuestionOption.findFirst).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  it("does not expose correctness or explanation in submitAnswer response", async () => {
    const repo = new QuizRepository();
    const answeredAt = new Date("2026-04-29T00:00:00.000Z");
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(answeredAt.getTime());

    prismaMock.quizSession.findFirst.mockResolvedValueOnce({
      correctCount: 0,
      id: "session-1",
      startedAt: new Date(answeredAt.getTime() - 1_000),
      test: { timeLimitSeconds: 60 },
      totalQuestions: 3
    });
    prismaMock.bjtQuestionOption.findFirst.mockResolvedValueOnce({
      isCorrect: true,
      question: { explanationVi: "secret explanation" }
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
            isCorrect: true,
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
            totalQuestions: 3
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

    expect(result.answer).toEqual({
      answeredAt,
      id: "answer-1",
      questionId: "question-1",
      selectedOption: "A",
      sessionId: "session-1"
    });
    expect(result.answer).not.toHaveProperty("isCorrect");
    expect(result).not.toHaveProperty("explanationVi");
    expect(result.session.status).toBe("in_progress");
    nowSpy.mockRestore();
  });

  it("blocks results lookup for in-progress sessions", async () => {
    const repo = new QuizRepository();

    prismaMock.quizSession.findFirst.mockResolvedValueOnce(null);

    await expect(
      repo.results(
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222"
      )
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prismaMock.quizSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "11111111-1111-4111-8111-111111111111",
          status: "completed",
          userId: "22222222-2222-4222-8222-222222222222"
        }
      })
    );
  });

  it("returns results for completed sessions", async () => {
    const repo = new QuizRepository();
    const completedSession = {
      answers: [],
      id: "session-1",
      status: "completed",
      test: { id: "test-1" }
    };

    prismaMock.quizSession.findFirst.mockResolvedValueOnce(completedSession);

    await expect(
      repo.results(
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222"
      )
    ).resolves.toEqual(completedSession);
  });
});
