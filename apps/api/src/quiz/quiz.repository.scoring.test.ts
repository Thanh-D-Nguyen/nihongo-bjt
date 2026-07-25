import { scoreBjtMockExam } from "@nihongo-bjt/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  bjtQuestion: {
    findMany: vi.fn()
  },
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

describe("QuizRepository BJT estimated scoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scores a completed official mock from persisted answers and section metadata", async () => {
    const repo = new QuizRepository();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-07-25T00:01:00.000Z"));
    const sessionUpdate = vi.fn().mockResolvedValue({
      estimatedBjtBand: "J3",
      estimatedScore: 400,
      id: "session-1",
      status: "completed"
    });
    const savedAnswers = [
      {
        isCorrect: false,
        question: {
          difficulty: "easy",
          section: { code: "listening" },
          skillTag: "gist"
        }
      },
      {
        isCorrect: true,
        question: {
          difficulty: "hard",
          section: { code: "reading" },
          skillTag: "detail"
        }
      }
    ];

    prismaMock.quizSession.findFirst.mockResolvedValueOnce({
      correctCount: 0,
      id: "session-1",
      shuffleMap: null,
      startedAt: new Date("2026-07-25T00:00:00.000Z"),
      test: { timeLimitSeconds: 7200, type: "official" },
      totalQuestions: 2
    });
    prismaMock.bjtQuestionOption.findFirst.mockResolvedValueOnce({
      isCorrect: true,
      question: {
        difficulty: "hard",
        remediationCardId: null,
        section: { code: "reading" },
        skillTag: "detail"
      }
    });
    prismaMock.quizAnswer.count.mockResolvedValueOnce(1);
    prismaMock.$transaction.mockImplementationOnce(async (callback) =>
      callback({
        analyticsEvent: {
          create: vi.fn().mockResolvedValue(undefined)
        },
        quizAnswer: {
          create: vi.fn().mockResolvedValue({
            answeredAt: new Date("2026-07-25T00:01:00.000Z"),
            id: "answer-2",
            questionId: "question-2",
            selectedOption: "B",
            sessionId: "session-1"
          }),
          findMany: vi.fn().mockResolvedValue(savedAnswers)
        },
        quizSession: {
          update: sessionUpdate
        }
      })
    );

    await repo.submitAnswer({
      optionKey: "B",
      questionId: "question-2",
      sessionId: "session-1",
      userId: "22222222-2222-4222-8222-222222222222"
    });

    expect(sessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estimatedBjtBand: "J3",
          estimatedScore: 400,
          status: "completed"
        })
      })
    );
    nowSpy.mockRestore();
  });

  it("scores unanswered questions as incorrect when a timed mock expires", async () => {
    const repo = new QuizRepository();
    const sessionUpdate = vi.fn().mockResolvedValue(undefined);
    const questions = [
      {
        answers: [{ isCorrect: true }],
        difficulty: "hard",
        section: { code: "listening" },
        skillTag: "detail"
      },
      {
        answers: [],
        difficulty: "standard",
        section: { code: "listening-reading" },
        skillTag: "inference"
      },
      {
        answers: [],
        difficulty: "easy",
        section: { code: "reading" },
        skillTag: "gist"
      }
    ];
    const expected = scoreBjtMockExam({
      items: questions.map((question) => ({
        answered: question.answers.length > 0,
        difficulty: question.difficulty,
        isCorrect: question.answers[0]?.isCorrect ?? false,
        sectionCode: question.section.code,
        skillTag: question.skillTag
      }))
    });

    prismaMock.quizSession.findFirst.mockResolvedValueOnce({
      correctCount: 1,
      currentQuestionNo: 1,
      id: "session-1",
      testId: "test-1",
      totalQuestions: 3
    });
    prismaMock.bjtQuestion.findMany.mockResolvedValueOnce(questions);
    prismaMock.$transaction.mockImplementationOnce(async (callback) =>
      callback({
        analyticsEvent: {
          create: vi.fn().mockResolvedValue(undefined)
        },
        quizSession: {
          update: sessionUpdate
        }
      })
    );

    const expirable = repo as unknown as {
      autoExpireSession(sessionId: string, userId: string): Promise<void>;
    };
    await expirable.autoExpireSession("session-1", "22222222-2222-4222-8222-222222222222");

    expect(sessionUpdate).toHaveBeenCalledWith({
      data: {
        completedAt: expect.any(Date),
        currentQuestionNo: 1,
        estimatedBjtBand: expected.estimatedBjtBand,
        estimatedScore: expected.estimatedScore,
        status: "completed"
      },
      where: { id: "session-1" }
    });
  });

  it("preserves raw practice scoring instead of applying full-mock section balancing", async () => {
    const repo = new QuizRepository();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-07-25T00:01:00.000Z"));
    const findSavedAnswers = vi.fn().mockResolvedValue([]);
    const sessionUpdate = vi.fn().mockResolvedValue({
      estimatedBjtBand: "J1+",
      estimatedScore: 800,
      id: "session-practice",
      status: "completed"
    });

    prismaMock.quizSession.findFirst.mockResolvedValueOnce({
      correctCount: 1,
      id: "session-practice",
      shuffleMap: null,
      startedAt: new Date("2026-07-25T00:00:00.000Z"),
      test: { timeLimitSeconds: 7200, type: "practice" },
      testId: "practice-test",
      totalQuestions: 2
    });
    prismaMock.bjtQuestionOption.findFirst.mockResolvedValueOnce({
      isCorrect: true,
      question: {
        difficulty: "standard",
        remediationCardId: null,
        section: { code: "reading" },
        skillTag: "detail"
      }
    });
    prismaMock.quizAnswer.count.mockResolvedValueOnce(1);
    prismaMock.$transaction.mockImplementationOnce(async (callback) =>
      callback({
        analyticsEvent: { create: vi.fn().mockResolvedValue(undefined) },
        quizAnswer: {
          create: vi.fn().mockResolvedValue({
            answeredAt: new Date("2026-07-25T00:01:00.000Z"),
            id: "answer-2",
            questionId: "question-2",
            selectedOption: "B",
            sessionId: "session-practice"
          }),
          findMany: findSavedAnswers
        },
        quizSession: { update: sessionUpdate }
      })
    );

    await repo.submitAnswer({
      optionKey: "B",
      questionId: "question-2",
      sessionId: "session-practice",
      userId: "22222222-2222-4222-8222-222222222222"
    });

    expect(findSavedAnswers).not.toHaveBeenCalled();
    expect(sessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estimatedBjtBand: "J1+",
          estimatedScore: 800
        })
      })
    );
    nowSpy.mockRestore();
  });
});
