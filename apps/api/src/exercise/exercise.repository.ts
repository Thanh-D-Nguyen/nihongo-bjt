import { createPrismaClient, Prisma } from "@nihongo-bjt/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class ExerciseRepository {
  private readonly prisma = createPrismaClient();

  /* ── Exercise Config (admin) ─────────────────────────────────────────── */

  async listConfigs() {
    return this.prisma.exerciseConfig.findMany({
      orderBy: [{ placement: "asc" }, { displayOrder: "asc" }]
    });
  }

  async upsertConfig(data: {
    exerciseType: string;
    placement: string;
    displayOrder: number;
    enabled: boolean;
    minLevel: string | null;
    maxLevel: string | null;
    timeLimitSec: number | null;
    pointsPerCorrect: number;
    actorId: string;
  }) {
    return this.prisma.exerciseConfig.upsert({
      where: {
        exerciseType_placement: {
          exerciseType: data.exerciseType,
          placement: data.placement
        }
      },
      create: {
        exerciseType: data.exerciseType,
        placement: data.placement,
        displayOrder: data.displayOrder,
        enabled: data.enabled,
        minLevel: data.minLevel,
        maxLevel: data.maxLevel,
        timeLimitSec: data.timeLimitSec,
        pointsPerCorrect: data.pointsPerCorrect,
        createdBy: data.actorId,
        updatedBy: data.actorId
      },
      update: {
        displayOrder: data.displayOrder,
        enabled: data.enabled,
        minLevel: data.minLevel,
        maxLevel: data.maxLevel,
        timeLimitSec: data.timeLimitSec,
        pointsPerCorrect: data.pointsPerCorrect,
        updatedBy: data.actorId
      }
    });
  }

  async deleteConfig(id: string) {
    return this.prisma.exerciseConfig.delete({ where: { id } });
  }

  async enabledConfigsForPlacement(placement: string) {
    return this.prisma.exerciseConfig.findMany({
      where: { placement, enabled: true },
      orderBy: { displayOrder: "asc" }
    });
  }

  /* ── Exercise CRUD ───────────────────────────────────────────────────── */

  async createExercise(data: {
    exerciseType: string;
    sourceType: string;
    sourceId: string;
    level: string | null;
    prompt: unknown;
    choices: unknown;
    correctAnswer: unknown;
    explanation: string | null;
    difficulty: string;
    tags: string[];
  }) {
    return this.prisma.exercise.create({
      data: {
        exerciseType: data.exerciseType,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        level: data.level,
        prompt: data.prompt as Prisma.InputJsonValue,
        choices: data.choices as Prisma.InputJsonValue,
        correctAnswer: data.correctAnswer as Prisma.InputJsonValue,
        explanation: data.explanation,
        difficulty: data.difficulty,
        tags: data.tags
      }
    });
  }

  async findExercisesByTypeAndLevel(
    exerciseType: string,
    level: string | undefined,
    limit: number
  ) {
    return this.prisma.exercise.findMany({
      where: {
        exerciseType,
        ...(level ? { level } : {})
      },
      take: limit,
      orderBy: { createdAt: "desc" }
    });
  }

  async findExerciseById(exerciseId: string) {
    return this.prisma.exercise.findUnique({ where: { id: exerciseId } });
  }

  /* ── Admin Exercise CRUD ─────────────────────────────────────────────── */

  async listExercisesAdmin(params: {
    exerciseType?: string;
    level?: string;
    page: number;
    pageSize: number;
  }) {
    const where: Record<string, unknown> = {};
    if (params.exerciseType) where.exerciseType = params.exerciseType;
    if (params.level) where.level = params.level;

    const [items, total] = await Promise.all([
      this.prisma.exercise.findMany({
        where,
        take: params.pageSize,
        skip: (params.page - 1) * params.pageSize,
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.exercise.count({ where })
    ]);

    return { items, total, page: params.page, pageSize: params.pageSize };
  }

  async updateExercise(id: string, data: {
    prompt?: unknown;
    choices?: unknown;
    correctAnswer?: unknown;
    explanation?: string | null;
    difficulty?: string;
    tags?: string[];
    level?: string | null;
  }) {
    const update: Record<string, unknown> = {};
    if (data.prompt !== undefined) update.prompt = data.prompt as Prisma.InputJsonValue;
    if (data.choices !== undefined) update.choices = data.choices as Prisma.InputJsonValue;
    if (data.correctAnswer !== undefined) update.correctAnswer = data.correctAnswer as Prisma.InputJsonValue;
    if (data.explanation !== undefined) update.explanation = data.explanation;
    if (data.difficulty !== undefined) update.difficulty = data.difficulty;
    if (data.tags !== undefined) update.tags = data.tags;
    if (data.level !== undefined) update.level = data.level;

    return this.prisma.exercise.update({ where: { id }, data: update });
  }

  async deleteExercise(id: string) {
    return this.prisma.exercise.delete({ where: { id } });
  }

  /* ── Session ─────────────────────────────────────────────────────────── */

  async createSession(data: {
    userId: string;
    sessionType: string;
    exerciseType: string;
    level: string | null;
  }) {
    return this.prisma.exerciseSession.create({
      data: {
        userId: data.userId,
        sessionType: data.sessionType,
        exerciseType: data.exerciseType,
        level: data.level
      }
    });
  }

  async findSession(id: string) {
    return this.prisma.exerciseSession.findUnique({ where: { id } });
  }

  async submitAnswer(data: {
    sessionId: string;
    exerciseId: string;
    userAnswer: unknown;
    isCorrect: boolean;
    timeSpentMs: number;
  }) {
    return this.prisma.exerciseAnswer.create({
      data: {
        sessionId: data.sessionId,
        exerciseId: data.exerciseId,
        userAnswer: data.userAnswer as Prisma.InputJsonValue,
        isCorrect: data.isCorrect,
        timeSpentMs: data.timeSpentMs
      }
    });
  }

  async completeSession(id: string) {
    const answers = await this.prisma.exerciseAnswer.findMany({
      where: { sessionId: id },
      select: { isCorrect: true }
    });
    const total = answers.length;
    const correct = answers.filter((a) => a.isCorrect).length;

    return this.prisma.exerciseSession.update({
      where: { id },
      data: {
        status: "completed",
        totalQuestions: total,
        correctCount: correct,
        score: correct * 10,
        completedAt: new Date()
      }
    });
  }

  async userSessionHistory(userId: string, limit: number) {
    return this.prisma.exerciseSession.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: limit,
      include: { _count: { select: { answers: true } } }
    });
  }

  /* ── Content queries (for exercise generation) ───────────────────────── */

  async randomLexemesWithExamples(level: string | undefined, limit: number) {
    const where: Prisma.LexemeWhereInput = { status: "active" };
    if (level) where.jlptLevel = level;

    return this.prisma.lexeme.findMany({
      where,
      take: limit * 3,
      include: {
        senses: {
          take: 1,
          orderBy: { position: "asc" },
          include: {
            exampleLinks: {
              take: 2,
              include: { exampleSentence: true }
            }
          }
        }
      }
    });
  }

  async randomGrammarPointsWithExamples(level: string | undefined, limit: number) {
    const where: Prisma.GrammarPointWhereInput = { status: "active" };
    if (level) where.jlptLevel = level;

    return this.prisma.grammarPoint.findMany({
      where,
      take: limit * 3,
      include: {
        details: {
          take: 1,
          include: {
            exampleLinks: {
              take: 2,
              include: { exampleSentence: true }
            }
          }
        }
      }
    });
  }

  async lexemeDistractors(excludeId: string, level: string | null, partOfSpeech: string | null, count: number) {
    const where: Prisma.LexemeWhereInput = {
      status: "active",
      id: { not: excludeId }
    };
    if (level) where.jlptLevel = level;

    const lexemes = await this.prisma.lexeme.findMany({
      where,
      take: count * 5,
      include: {
        senses: { take: 1, orderBy: { position: "asc" } }
      }
    });

    // Filter by POS if available, then shuffle and take `count`
    let filtered = partOfSpeech
      ? lexemes.filter((l) => l.senses[0]?.partOfSpeech === partOfSpeech)
      : lexemes;
    if (filtered.length < count) filtered = lexemes;

    return shuffleArray(filtered).slice(0, count);
  }

  async grammarDistractors(excludeId: string, level: string | null, count: number) {
    const where: Prisma.GrammarPointWhereInput = {
      status: "active",
      id: { not: excludeId }
    };
    if (level) where.jlptLevel = level;

    const points = await this.prisma.grammarPoint.findMany({
      where,
      take: count * 5
    });

    return shuffleArray(points).slice(0, count);
  }

  /* ── User Exercise Performance (Adaptive Difficulty) ─────────────────── */

  async getUserPerformance(userId: string, exerciseType: string, level: string | null) {
    return this.prisma.userExercisePerformance.findUnique({
      where: {
        userId_exerciseType_level: {
          userId,
          exerciseType,
          level: level ?? "all"
        }
      }
    });
  }

  async getUserPerformanceByType(userId: string, exerciseType: string) {
    return this.prisma.userExercisePerformance.findMany({
      where: { userId, exerciseType }
    });
  }

  async getAllUserPerformance(userId: string) {
    return this.prisma.userExercisePerformance.findMany({
      where: { userId },
      orderBy: [{ exerciseType: "asc" }, { level: "asc" }]
    });
  }

  /* ── Exercise Remediation (auto-flashcard) ───────────────────────────── */

  async findRemediation(userId: string, exerciseId: string) {
    return this.prisma.exerciseRemediation.findUnique({
      where: { userId_exerciseId: { userId, exerciseId } }
    });
  }

  async createRemediation(data: {
    userId: string;
    exerciseId: string;
    cardId: string;
    sourceType: string;
    sourceId: string;
  }) {
    return this.prisma.exerciseRemediation.create({ data });
  }

  async createRemediationFlashcard(data: {
    sourceType: string;
    sourceId: string;
    frontText: string;
    backText: string;
    reading?: string;
  }) {
    return this.prisma.flashcardVariant.create({
      data: {
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        frontText: data.frontText,
        backText: data.backText,
        reading: data.reading
      }
    });
  }

  async createUserFlashcard(userId: string, cardId: string) {
    return this.prisma.userFlashcard.upsert({
      where: { userId_cardId: { userId, cardId } },
      create: { userId, cardId, state: "new", dueAt: new Date() },
      update: {} // already exists, skip
    });
  }

  async getUserRemediations(userId: string, limit: number = 20) {
    return this.prisma.exerciseRemediation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }

  /* ── Daily Goal Tracking ─────────────────────────────────────────────── */

  async countTodayExercises(userId: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return this.prisma.exerciseAnswer.count({
      where: {
        session: { userId },
        answeredAt: { gte: todayStart }
      }
    });
  }

  async getDailyGoalExercises(userId: string): Promise<number> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { id: userId },
      select: { dailyGoalExercises: true }
    });
    return profile?.dailyGoalExercises ?? 10;
  }

  /* ── Exercise SRS (Spaced Repetition) ────────────────────────────────── */

  async findReviewState(userId: string, exerciseId: string) {
    return this.prisma.exerciseReviewState.findUnique({
      where: { userId_exerciseId: { userId, exerciseId } }
    });
  }

  async upsertReviewState(data: {
    userId: string;
    exerciseId: string;
    state: string;
    easeFactor: number;
    intervalDays: number;
    repetitions: number;
    lapses: number;
    dueAt: Date;
  }) {
    return this.prisma.exerciseReviewState.upsert({
      where: { userId_exerciseId: { userId: data.userId, exerciseId: data.exerciseId } },
      create: data,
      update: {
        state: data.state,
        easeFactor: data.easeFactor,
        intervalDays: data.intervalDays,
        repetitions: data.repetitions,
        lapses: data.lapses,
        dueAt: data.dueAt
      }
    });
  }

  async getDueExercises(userId: string, limit: number = 20) {
    return this.prisma.exerciseReviewState.findMany({
      where: {
        userId,
        dueAt: { lte: new Date() },
        state: { not: "graduated" }
      },
      orderBy: { dueAt: "asc" },
      take: limit
    });
  }

  async getDueExercisesWithDetails(userId: string, limit: number = 20) {
    const states = await this.getDueExercises(userId, limit);
    if (states.length === 0) return [];

    const exerciseIds = states.map((s) => s.exerciseId);
    const exercises = await this.prisma.exercise.findMany({
      where: { id: { in: exerciseIds } }
    });

    const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
    return states.map((s) => ({
      ...s,
      exercise: exerciseMap.get(s.exerciseId) ?? null
    }));
  }

  async countDueExercises(userId: string): Promise<number> {
    return this.prisma.exerciseReviewState.count({
      where: {
        userId,
        dueAt: { lte: new Date() },
        state: { not: "graduated" }
      }
    });
  }

  async upsertPerformance(data: {
    userId: string;
    exerciseType: string;
    level: string | null;
    isCorrect: boolean;
    timeSpentMs: number;
  }) {
    const key = {
      userId: data.userId,
      exerciseType: data.exerciseType,
      level: data.level ?? "all"
    };

    const existing = await this.prisma.userExercisePerformance.findUnique({
      where: { userId_exerciseType_level: key }
    });

    if (!existing) {
      // Create new record
      const recentWindow = [data.isCorrect];
      return this.prisma.userExercisePerformance.create({
        data: {
          userId: data.userId,
          exerciseType: data.exerciseType,
          level: data.level ?? "all",
          totalAttempts: 1,
          totalCorrect: data.isCorrect ? 1 : 0,
          recentAccuracy: data.isCorrect ? 1.0 : 0.0,
          currentDifficulty: "medium",
          avgTimeMs: data.timeSpentMs,
          recentWindow: recentWindow as unknown as Prisma.InputJsonValue
        }
      });
    }

    // Update existing — maintain sliding window of last 20
    const window = (existing.recentWindow as boolean[]) ?? [];
    window.push(data.isCorrect);
    if (window.length > 20) window.shift();

    const recentCorrect = window.filter(Boolean).length;
    const recentAccuracy = window.length > 0 ? recentCorrect / window.length : 0.5;

    // Adaptive difficulty logic
    const currentDifficulty = computeAdaptiveDifficulty(recentAccuracy, existing.currentDifficulty);

    // Running average time
    const newTotal = existing.totalAttempts + 1;
    const avgTimeMs = Math.round(
      (existing.avgTimeMs * existing.totalAttempts + data.timeSpentMs) / newTotal
    );

    return this.prisma.userExercisePerformance.update({
      where: { userId_exerciseType_level: key },
      data: {
        totalAttempts: newTotal,
        totalCorrect: existing.totalCorrect + (data.isCorrect ? 1 : 0),
        recentAccuracy,
        currentDifficulty,
        avgTimeMs,
        recentWindow: window as unknown as Prisma.InputJsonValue
      }
    });
  }

  /* ── Admin Performance Analytics ─────────────────────────────────────── */

  async getPerformanceAnalytics(params?: { exerciseType?: string; level?: string }) {
    const where: Record<string, unknown> = {};
    if (params?.exerciseType) where.exerciseType = params.exerciseType;
    if (params?.level) where.level = params.level;

    const [byType, byLevel, overall] = await Promise.all([
      this.prisma.userExercisePerformance.groupBy({
        by: ["exerciseType"],
        where,
        _avg: { accuracy: true, avgTimeMs: true },
        _sum: { totalAttempts: true, correctCount: true },
        _count: true
      }),
      this.prisma.userExercisePerformance.groupBy({
        by: ["level"],
        where,
        _avg: { accuracy: true, avgTimeMs: true },
        _sum: { totalAttempts: true, correctCount: true },
        _count: true
      }),
      this.prisma.userExercisePerformance.aggregate({
        where,
        _avg: { accuracy: true, avgTimeMs: true },
        _sum: { totalAttempts: true, correctCount: true },
        _count: true
      })
    ]);

    return {
      overall: {
        totalUsers: overall._count,
        avgAccuracy: overall._avg.accuracy,
        avgTimeMs: overall._avg.avgTimeMs,
        totalAttempts: overall._sum.totalAttempts,
        totalCorrect: overall._sum.correctCount
      },
      byType: byType.map((r) => ({
        exerciseType: r.exerciseType,
        users: r._count,
        avgAccuracy: r._avg.accuracy,
        avgTimeMs: r._avg.avgTimeMs,
        totalAttempts: r._sum.totalAttempts,
        totalCorrect: r._sum.correctCount
      })),
      byLevel: byLevel.map((r) => ({
        level: r.level,
        users: r._count,
        avgAccuracy: r._avg.accuracy,
        avgTimeMs: r._avg.avgTimeMs,
        totalAttempts: r._sum.totalAttempts,
        totalCorrect: r._sum.correctCount
      }))
    };
  }
}

/**
 * Compute adaptive difficulty based on recent accuracy.
 * - accuracy >= 0.85 → promote to harder
 * - accuracy <= 0.45 → demote to easier
 * - otherwise → stay
 */
function computeAdaptiveDifficulty(
  recentAccuracy: number,
  current: string
): string {
  const levels = ["easy", "medium", "hard"];
  const idx = levels.indexOf(current);
  if (idx === -1) return "medium";

  if (recentAccuracy >= 0.85 && idx < levels.length - 1) {
    return levels[idx + 1];
  }
  if (recentAccuracy <= 0.45 && idx > 0) {
    return levels[idx - 1];
  }
  return current;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
