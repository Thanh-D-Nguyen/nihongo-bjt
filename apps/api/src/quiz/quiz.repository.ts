import { createPrismaClient, type Prisma } from "@nihongo-bjt/database";
import { scoreBjtPractice } from "@nihongo-bjt/shared";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

@Injectable()
export class QuizRepository {
  private readonly prisma = createPrismaClient();

  private hasSessionExpired(startedAt: Date, timeLimitSeconds: number | null): boolean {
    if (!timeLimitSeconds || timeLimitSeconds <= 0) {
      return false;
    }

    const expiresAt = startedAt.getTime() + timeLimitSeconds * 1000;
    return Date.now() >= expiresAt;
  }

  private templateForStart(
    id: string,
    tx: Prisma.TransactionClient | typeof this.prisma = this.prisma
  ) {
    return tx.bjtMockTest.findFirst({
      include: {
        sections: {
          include: { questions: { select: { id: true } } }
        }
      },
      where: { id, status: "published" }
    });
  }

  templates() {
    return this.prisma.bjtMockTest.findMany({
      include: { _count: { select: { sections: true, sessions: true } } },
      orderBy: { createdAt: "desc" },
      where: { status: "published" }
    });
  }

  async adminListTests(params: { limit: number; offset: number; status?: string; type?: string }) {
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    if (params.type) where.type = params.type;
    const [items, total] = await Promise.all([
      this.prisma.bjtMockTest.findMany({
        include: { _count: { select: { sections: true, sessions: true } } },
        orderBy: { createdAt: "desc" },
        skip: params.offset,
        take: params.limit,
        where
      }),
      this.prisma.bjtMockTest.count({ where })
    ]);
    return { items, total };
  }

  template(id: string) {
    return this.prisma.bjtMockTest.findFirst({
      include: {
        sections: {
          include: {
            questions: {
              select: {
                createdAt: true,
                difficulty: true,
                id: true,
                options: {
                  orderBy: { optionKey: "asc" },
                  select: {
                    createdAt: true,
                    id: true,
                    optionKey: true,
                    questionId: true,
                    text: true
                  }
                },
                prompt: true,
                scenario: true,
                skillTag: true,
                sourceId: true,
                sourceType: true,
                updatedAt: true
              }
            }
          },
          orderBy: { displayOrder: "asc" }
        }
      },
      where: { id, status: "published" }
    });
  }

  async startSession(
    testId: string,
    userId: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx ?? this.prisma;
    const test = await this.templateForStart(testId, client);
    if (!test) {
      throw new NotFoundException("Quiz template not found");
    }

    const totalQuestions = test.sections.reduce(
      (count, section) => count + section.questions.length,
      0
    );

    const run = async (trx: Prisma.TransactionClient) => {
      const session = await trx.quizSession.create({
        data: {
          testId,
          totalQuestions,
          userId
        }
      });

      await trx.analyticsEvent.create({
        data: {
          eventName: "quiz_session_started",
          payload: { sessionId: session.id, testId, totalQuestions },
          source: "api",
          userId
        }
      });

      return session;
    };

    if (tx) {
      return run(tx);
    }

    return this.prisma.$transaction(async (trx) => run(trx));
  }

  async currentQuestion(sessionId: string, userId: string) {
    const session = await this.prisma.quizSession.findFirst({
      include: {
        answers: { select: { questionId: true } },
        test: {
          select: {
            sections: {
              include: {
                questions: {
                  select: {
                    createdAt: true,
                    difficulty: true,
                    id: true,
                    options: {
                      orderBy: { optionKey: "asc" },
                      select: {
                        createdAt: true,
                        id: true,
                        optionKey: true,
                        questionId: true,
                        text: true
                      }
                    },
                    prompt: true,
                    scenario: true,
                    skillTag: true,
                    sourceId: true,
                    sourceType: true,
                    updatedAt: true
                  },
                  orderBy: { createdAt: "asc" }
                }
              },
              orderBy: { displayOrder: "asc" }
            },
            timeLimitSeconds: true
          }
        }
      },
      where: { id: sessionId, userId }
    });

    if (!session) {
      throw new NotFoundException("Quiz session not found");
    }

    if (this.hasSessionExpired(session.startedAt, session.test.timeLimitSeconds)) {
      throw new ForbiddenException("Quiz session expired");
    }

    const answeredIds = new Set(session.answers.map((answer) => answer.questionId));
    const question = session.test.sections
      .flatMap((section) => section.questions)
      .find((item) => !answeredIds.has(item.id));

    const sanitizedQuestion = question
      ? {
          createdAt: question.createdAt,
          difficulty: question.difficulty,
          id: question.id,
          options: question.options.map((option) => ({
            createdAt: option.createdAt,
            id: option.id,
            optionKey: option.optionKey,
            questionId: option.questionId,
            text: option.text
          })),
          prompt: question.prompt,
          scenario: question.scenario,
          skillTag: question.skillTag,
          sourceId: question.sourceId,
          sourceType: question.sourceType,
          updatedAt: question.updatedAt
        }
      : null;

    return {
      question: sanitizedQuestion,
      session: {
        correctCount: session.correctCount,
        currentQuestionNo: session.currentQuestionNo,
        id: session.id,
        status: session.status,
        totalQuestions: session.totalQuestions
      }
    };
  }

  async submitAnswer(input: {
    optionKey: string;
    questionId: string;
    sessionId: string;
    userId: string;
  }) {
    const session = await this.prisma.quizSession.findFirst({
      include: { test: { select: { timeLimitSeconds: true } } },
      where: { id: input.sessionId, status: "in_progress", userId: input.userId }
    });
    if (!session) {
      throw new NotFoundException("Active quiz session not found");
    }

    if (this.hasSessionExpired(session.startedAt, session.test.timeLimitSeconds)) {
      throw new ForbiddenException("Quiz session expired");
    }

    const option = await this.prisma.bjtQuestionOption.findFirst({
      include: {
        question: {
          select: {
            remediationCardId: true
          }
        }
      },
      where: {
        optionKey: input.optionKey,
        questionId: input.questionId
      }
    });
    if (!option) {
      throw new NotFoundException("Question option not found");
    }

    const existingAnswers = await this.prisma.quizAnswer.count({
      where: { sessionId: input.sessionId }
    });
    const correctCount = session.correctCount + (option.isCorrect ? 1 : 0);
    const answeredCount = existingAnswers + 1;
    const completed = answeredCount >= session.totalQuestions;
    const score = completed
      ? scoreBjtPractice({ correctCount, totalQuestions: session.totalQuestions })
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      const answer = await tx.quizAnswer.create({
        data: {
          isCorrect: option.isCorrect,
          questionId: input.questionId,
          selectedOption: input.optionKey,
          sessionId: input.sessionId
        }
      });

      const updated = await tx.quizSession.update({
        data: {
          completedAt: completed ? new Date() : undefined,
          correctCount,
          currentQuestionNo: answeredCount,
          estimatedBjtBand: score?.estimatedBjtBand,
          estimatedScore: score?.estimatedScore,
          status: completed ? "completed" : "in_progress"
        },
        where: { id: input.sessionId }
      });

      await tx.analyticsEvent.create({
        data: {
          eventName: completed ? "quiz_session_completed" : "quiz_answer_submitted",
          payload: {
            answeredCount,
            isCorrect: option.isCorrect,
            questionId: input.questionId,
            sessionId: input.sessionId
          },
          source: "api",
          userId: input.userId
        }
      });

      return {
        answer: {
          answeredAt: answer.answeredAt,
          id: answer.id,
          questionId: answer.questionId,
          selectedOption: answer.selectedOption,
          sessionId: answer.sessionId
        },
        ...(option.isCorrect
          ? {}
          : {
              remediationCardId: option.question.remediationCardId
            }),
        session: updated
      };
    });
  }

  async remediation(sessionId: string, userId: string) {
    const session = await this.prisma.quizSession.findFirst({
      include: {
        answers: {
          include: {
            question: {
              select: {
                id: true,
                remediationCard: {
                  select: {
                    backText: true,
                    frontText: true,
                    id: true,
                    reading: true,
                    sourceId: true,
                    sourceType: true
                  }
                },
                remediationCardId: true
              }
            }
          },
          orderBy: { answeredAt: "asc" },
          where: {
            isCorrect: false,
            question: {
              remediationCardId: {
                not: null
              }
            }
          }
        }
      },
      where: { id: sessionId, status: "completed", userId }
    });

    if (!session) {
      throw new NotFoundException("Completed quiz session not found");
    }

    return session.answers.flatMap((answer) =>
      answer.question.remediationCard && answer.question.remediationCardId
        ? [
            {
              card: answer.question.remediationCard,
              questionId: answer.question.id,
              remediationCardId: answer.question.remediationCardId
            }
          ]
        : []
    );
  }

  async results(sessionId: string, userId: string) {
    const session = await this.prisma.quizSession.findFirst({
      include: {
        answers: {
          include: { question: { include: { options: { orderBy: { optionKey: "asc" } } } } },
          orderBy: { answeredAt: "asc" }
        },
        test: true
      },
      where: { id: sessionId, status: "completed", userId }
    });

    if (!session) {
      throw new NotFoundException("Completed quiz session not found");
    }

    return session;
  }

  private validateBjtQuestionIntegrity(question: { explanationVi: string; skillTag: string; options: { isCorrect: boolean }[] }): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!question.explanationVi || question.explanationVi.trim().length === 0) {
      issues.push("Missing explanationVi");
    }

    if (!question.skillTag || question.skillTag.trim().length === 0) {
      issues.push("Missing skillTag");
    }

    const hasCorrectOption = question.options.some((opt) => opt.isCorrect);
    if (!hasCorrectOption) {
      issues.push("No correct option found");
    }

    return { isValid: issues.length === 0, issues };
  }

  async listQualityIssues() {
    const questions = await this.prisma.bjtQuestion.findMany({
      include: {
        options: { select: { isCorrect: true } }
      },
      where: { status: "published" }
    });

    const issuesList = questions
      .map((q) => ({
        questionId: q.id,
        skillTag: q.skillTag,
        validation: this.validateBjtQuestionIntegrity(q),
        qualityFlags: q.qualityFlags as Record<string, unknown> | null
      }))
      .filter((item) => !item.validation.isValid || (item.qualityFlags && Object.keys(item.qualityFlags).length > 0));

    return issuesList;
  }

  async breakdown(sessionId: string, userId: string) {
    const session = await this.prisma.quizSession.findFirst({
      include: {
        answers: {
          include: {
            question: {
              select: {
                id: true,
                prompt: true,
                explanationVi: true,
                remediationCardId: true,
                options: {
                  orderBy: { optionKey: "asc" },
                  select: { optionKey: true, isCorrect: true }
                }
              }
            }
          },
          orderBy: { answeredAt: "asc" }
        },
        test: {
          select: {
            id: true,
            titleVi: true,
            titleJa: true
          }
        }
      },
      where: { id: sessionId, status: "completed", userId }
    });

    if (!session) {
      throw new NotFoundException("Completed quiz session not found");
    }

    const breakdown = session.answers.map((answer) => {
      const selectedCorrect = answer.question.options.find((opt) => opt.optionKey === answer.selectedOption)?.isCorrect ?? false;
      return {
        questionId: answer.question.id,
        prompt: answer.question.prompt,
        selectedOption: answer.selectedOption,
        isCorrect: selectedCorrect,
        explanationVi: answer.question.explanationVi,
        remediationCardId: selectedCorrect ? undefined : answer.question.remediationCardId
      };
    });

    return {
      sessionId: session.id,
      testId: session.test.id,
      testTitleVi: session.test.titleVi,
      testTitleJa: session.test.titleJa,
      estimatedScore: session.estimatedScore,
      estimatedBjtBand: session.estimatedBjtBand,
      breakdown
    };
  }
}
