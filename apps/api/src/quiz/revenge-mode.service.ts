import { createPrismaClient } from "@nihongo-bjt/database";
import { shuffleArray } from "@nihongo-bjt/shared";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";

@Injectable()
export class RevengeModeService {
  private readonly logger = new Logger(RevengeModeService.name);
  private readonly prisma = createPrismaClient();

  /**
   * Get revenge queue: wrong answers from last 7 days that haven't been correctly revenged yet.
   * Returns up to `limit` questions with their options.
   */
  async getRevengeQueue(userId: string, limit = 5) {
    try {
      return await this._getRevengeQueueInner(userId, limit);
    } catch (err) {
      this.logger.error(`getRevengeQueue failed for user ${userId}`, err instanceof Error ? err.stack : err);
      return { questions: [], totalPending: 0 };
    }
  }

  private async _getRevengeQueueInner(userId: string, limit: number) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get wrong answers from recent quiz sessions
    const wrongAnswers = await this.prisma.quizAnswer.findMany({
      where: {
        isCorrect: false,
        answeredAt: { gte: sevenDaysAgo },
        session: { userId },
      },
      include: {
        question: {
          include: {
            options: { orderBy: { optionKey: "asc" } },
          },
        },
      },
      orderBy: { answeredAt: "desc" },
      take: 20, // fetch more than needed for filtering
    });

    if (wrongAnswers.length === 0) return { questions: [], totalPending: 0 };

    // Filter out questions already correctly revenged
    const questionIds = wrongAnswers.map((a) => a.questionId);
    const revengedCorrectly = await this.prisma.revengeAttempt.findMany({
      where: {
        userId,
        questionId: { in: questionIds },
        isCorrect: true,
      },
      select: { questionId: true },
    });
    const revengedSet = new Set(revengedCorrectly.map((r) => r.questionId));

    const pending = wrongAnswers
      .filter((a) => !revengedSet.has(a.questionId))
      // Deduplicate by questionId
      .filter(
        (a, i, arr) =>
          arr.findIndex((x) => x.questionId === a.questionId) === i,
      );

    const selected = pending.slice(0, limit);

    return {
      questions: selected.map((a) => {
        // Shuffle options per-serving to prevent position memorization
        const shuffled = shuffleArray(a.question.options);
        const KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"];
        return {
          questionId: a.questionId,
          prompt: a.question.prompt,
          scenario: a.question.scenario,
          skillTag: a.question.skillTag,
          difficulty: a.question.difficulty,
          options: shuffled.map((o, i) => ({
            key: KEYS[i] ?? String(i + 1),
            text: o.text,
            originalKey: o.optionKey,
          })),
          wrongAnswerDate: a.answeredAt,
          yourAnswer: a.selectedOption,
        };
      }),
      totalPending: pending.length,
    };
  }

  /** Submit a revenge answer */
  async submitAnswer(
    userId: string,
    questionId: string,
    selectedOption: string,
  ) {
    // Find the correct option
    const correctOption = await this.prisma.bjtQuestionOption.findFirst({
      where: { questionId, isCorrect: true },
    });
    if (!correctOption) {
      throw new NotFoundException("Question not found");
    }

    const isCorrect = correctOption.optionKey === selectedOption;

    await this.prisma.revengeAttempt.create({
      data: { userId, questionId, isCorrect },
    });

    return {
      isCorrect,
      correctOption: correctOption.optionKey,
    };
  }

  /** Get revenge stats */
  async getStats(userId: string) {
    const [total, correct] = await Promise.all([
      this.prisma.revengeAttempt.count({ where: { userId } }),
      this.prisma.revengeAttempt.count({
        where: { userId, isCorrect: true },
      }),
    ]);
    return {
      totalAttempts: total,
      correctAttempts: correct,
      accuracyPct: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
  }
}
