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

  async lexemeDistractors(excludeId: string, level: string | null, partOfSpeech: string | null, count: number, difficulty?: string) {
    const baseWhere: Prisma.LexemeWhereInput = {
      status: "active",
      id: { not: excludeId }
    };
    if (level) baseWhere.jlptLevel = level;

    const [target, sameLevel] = await Promise.all([
      this.prisma.lexeme.findUnique({
        where: { id: excludeId },
        include: { senses: { take: 1, orderBy: { position: "asc" } } }
      }),
      this.prisma.lexeme.findMany({
        where: baseWhere,
        take: count * 24,
        include: {
          senses: { take: 1, orderBy: { position: "asc" } }
        }
      })
    ]);

    let pool = sameLevel;
    if (pool.length < count) {
      const broader = await this.prisma.lexeme.findMany({
        where: { status: "active", id: { not: excludeId } },
        take: count * 32,
        include: {
          senses: { take: 1, orderBy: { position: "asc" } }
        }
      });
      pool = uniqueLexemes([...pool, ...broader]);
    }

    const targetMeaning = target?.senses[0]?.meaningVi ?? "";

    const scored = pool
      .filter((lexeme) => Boolean(lexeme.senses[0]?.meaningVi))
      // Anti-synonym: reject if meaning is too similar to correct (would create ambiguity)
      .filter((lexeme) => {
        if (!targetMeaning) return true;
        const similarity = vietnameseSimilarity(lexeme.senses[0]!.meaningVi, targetMeaning);
        return similarity < 0.85; // reject near-duplicates
      })
      .map((lexeme) => ({
        lexeme,
        score: scoreLexemeDistractor({
          candidate: lexeme,
          difficulty: difficulty ?? "medium",
          level,
          partOfSpeech,
          target: target ?? null
        })
      }))
      .sort((a, b) => b.score - a.score);

    // Diversity selection: pick top distractors that aren't too similar to each other
    return selectDiverseDistractors(
      scored.map((s) => ({ item: s.lexeme, meaning: s.lexeme.senses[0]?.meaningVi ?? "" })),
      count
    );
  }

  async grammarDistractors(excludeId: string, level: string | null, count: number) {
    const baseWhere: Prisma.GrammarPointWhereInput = {
      status: "active",
      id: { not: excludeId }
    };
    if (level) baseWhere.jlptLevel = level;

    const [target, sameLevel] = await Promise.all([
      this.prisma.grammarPoint.findUnique({ where: { id: excludeId } }),
      this.prisma.grammarPoint.findMany({
        where: baseWhere,
        take: count * 24
      })
    ]);

    let pool = sameLevel;
    if (pool.length < count) {
      const broader = await this.prisma.grammarPoint.findMany({
        where: { status: "active", id: { not: excludeId } },
        take: count * 32
      });
      pool = uniqueGrammarPoints([...pool, ...broader]);
    }

    const targetMeaning = target?.meaningVi ?? "";

    const scored = pool
      // Anti-synonym: reject if meaning is too similar
      .filter((point) => {
        if (!targetMeaning) return true;
        return vietnameseSimilarity(point.meaningVi, targetMeaning) < 0.85;
      })
      .map((point) => ({ point, score: scoreGrammarDistractor(point, target, level) }))
      .sort((a, b) => b.score - a.score);

    // Diversity selection
    return selectDiverseDistractors(
      scored.map((s) => ({ item: s.point, meaning: s.point.meaningVi })),
      count
    );
  }

  async sentenceTranslationDistractors(input: {
    excludeExampleId: string;
    level: string | null;
    partOfSpeech: string | null;
    translationVi: string;
    count: number;
  }) {
    const where: Prisma.LexemeWhereInput = { status: "active" };
    if (input.level) where.jlptLevel = input.level;
    const lexemes = await this.prisma.lexeme.findMany({
      where,
      take: input.count * 36,
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
    const examples = lexemes.flatMap((lexeme) =>
      lexeme.senses
        .filter((sense) => !input.partOfSpeech || posOverlap(sense.partOfSpeech, input.partOfSpeech))
        .flatMap((sense) =>
        (sense.exampleLinks ?? [])
          .map((link) => link.exampleSentence)
          .filter((example): example is NonNullable<typeof example> => Boolean(example?.translationVi))
      )
    );
    return uniqueExamples(examples)
      .filter((example) => example.id !== input.excludeExampleId && example.translationVi !== input.translationVi)
      // Anti-synonym: reject if translation is near-identical to correct
      .filter((example) => vietnameseSimilarity(example.translationVi ?? "", input.translationVi) < 0.85)
      .map((example) => ({
        example,
        score: scoreSentenceDistractor(example.translationVi ?? "", input.translationVi)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, input.count)
      .map((item) => item.example);
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

type LexemeDistractorCandidate = {
  headword: string;
  jlptLevel: string | null;
  reading: string | null;
  senses: Array<{ field: string | null; meaningVi: string; partOfSpeech: string | null }>;
};

type GrammarDistractorCandidate = {
  category: string | null;
  jlptLevel: string | null;
  meaningVi: string;
  pattern: string;
};

function scoreLexemeDistractor(input: {
  candidate: LexemeDistractorCandidate;
  difficulty: string;
  level: string | null;
  partOfSpeech: string | null;
  target: LexemeDistractorCandidate | null;
}) {
  const candidateSense = input.candidate.senses[0];
  const targetSense = input.target?.senses[0];
  let score = 0;

  // Core matching signals (always important)
  if (input.level && input.candidate.jlptLevel === input.level) score += 30;
  if (posOverlap(candidateSense?.partOfSpeech ?? null, input.partOfSpeech)) score += 40;

  if (input.target) {
    // Script similarity (katakana distractors for katakana words, etc.)
    if (scriptProfile(input.candidate.headword) === scriptProfile(input.target.headword)) score += 18;
    // Headword length proximity
    score += proximityScore(input.candidate.headword.length, input.target.headword.length, 14);
    // Reading length proximity
    score += proximityScore((input.candidate.reading ?? "").length, (input.target.reading ?? "").length, 8);

    // Vietnamese meaning similarity — the KEY signal for quality distractors
    if (targetSense?.meaningVi && candidateSense?.meaningVi) {
      const viSim = vietnameseSimilarity(candidateSense.meaningVi, targetSense.meaningVi);
      // Difficulty-aware: hard → prefer high similarity, easy → prefer medium similarity
      if (input.difficulty === "hard") {
        // Hard: distractors with 40-80% similarity are ideal (confusing but distinct)
        score += viSim >= 0.4 && viSim <= 0.8 ? 50 : viSim >= 0.2 ? 25 : 0;
      } else if (input.difficulty === "easy") {
        // Easy: distractors with 10-40% similarity (same domain but clearly different)
        score += viSim >= 0.1 && viSim <= 0.4 ? 40 : viSim > 0.4 ? 20 : 0;
      } else {
        // Medium: 20-60% similarity range
        score += viSim >= 0.2 && viSim <= 0.6 ? 45 : viSim >= 0.1 ? 20 : 0;
      }
      // Meaning length proximity (answers should look similar)
      score += proximityScore(candidateSense.meaningVi.length, targetSense.meaningVi.length, 12);
    }

    // Semantic field bonus (if available)
    if (candidateSense?.field && candidateSense.field === targetSense?.field) score += 24;
  }

  return score + Math.random();
}

function scoreGrammarDistractor(
  candidate: GrammarDistractorCandidate,
  target: GrammarDistractorCandidate | null,
  level: string | null
) {
  let score = 0;
  if (level && candidate.jlptLevel === level) score += 30;
  if (target?.category && candidate.category === target.category) score += 36;
  if (target) {
    score += proximityScore(candidate.pattern.length, target.pattern.length, 18);
    score += sharedCharacterScore(candidate.pattern, target.pattern, 12);
    // Vietnamese meaning similarity — crucial for grammar confusion
    const viSim = vietnameseSimilarity(candidate.meaningVi, target.meaningVi);
    score += viSim >= 0.2 && viSim <= 0.7 ? 40 : viSim >= 0.1 ? 15 : 0;
    score += proximityScore(candidate.meaningVi.length, target.meaningVi.length, 10);
  }
  return score + Math.random();
}

function scoreSentenceDistractor(candidate: string, target: string) {
  return proximityScore(candidate.length, target.length, 60) + sharedVietnameseTokenScore(candidate, target, 20) + Math.random();
}

function posOverlap(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const left = new Set(a.split(/[,\s/]+/u).filter(Boolean));
  return b.split(/[,\s/]+/u).some((part) => left.has(part));
}

function scriptProfile(value: string) {
  if (/^[\p{Script=Katakana}ー]+$/u.test(value)) return "katakana";
  if (/^[\p{Script=Hiragana}ー]+$/u.test(value)) return "hiragana";
  if (/^[\p{Script=Han}々〆ヵヶ]+$/u.test(value)) return "kanji";
  if (/[\p{Script=Han}]/u.test(value) && /[\p{Script=Hiragana}]/u.test(value)) return "kanji-kana";
  return "mixed";
}

function proximityScore(candidate: number, target: number, max: number) {
  if (target <= 0) return 0;
  const diff = Math.abs(candidate - target);
  return Math.max(0, max - diff);
}

function sharedCharacterScore(a: string, b: string, max: number) {
  const chars = new Set(a.split(""));
  const shared = b.split("").filter((char) => chars.has(char)).length;
  return Math.min(max, shared * 2);
}

function sharedVietnameseTokenScore(a: string, b: string, max: number) {
  const tokens = new Set(tokenizeVietnamese(a));
  const shared = tokenizeVietnamese(b).filter((token) => tokens.has(token)).length;
  return Math.min(max, shared * 4);
}

function tokenizeVietnamese(value: string) {
  return value
    .toLowerCase()
    .normalize("NFC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 3);
}

/**
 * Vietnamese text similarity using Jaccard coefficient of word tokens + character bigrams.
 * Returns 0-1 (0 = completely different, 1 = identical).
 * This is the core signal for distractor quality without embeddings.
 */
function vietnameseSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  // Token-level Jaccard (captures semantic overlap)
  const tokensA = new Set(tokenizeVietnamese(a));
  const tokensB = new Set(tokenizeVietnamese(b));
  const tokenUnion = new Set([...tokensA, ...tokensB]);
  const tokenIntersect = [...tokensA].filter((t) => tokensB.has(t)).length;
  const tokenJaccard = tokenUnion.size > 0 ? tokenIntersect / tokenUnion.size : 0;

  // Character bigram Jaccard (captures partial word overlap, morphological similarity)
  const bigramsA = charBigrams(a);
  const bigramsB = charBigrams(b);
  const bigramUnion = new Set([...bigramsA, ...bigramsB]);
  const bigramIntersect = [...bigramsA].filter((bg) => bigramsB.has(bg)).length;
  const bigramJaccard = bigramUnion.size > 0 ? bigramIntersect / bigramUnion.size : 0;

  // Weighted combination: tokens matter more for meaning, bigrams for form
  return tokenJaccard * 0.65 + bigramJaccard * 0.35;
}

function charBigrams(value: string): Set<string> {
  const normalized = value.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "");
  const bigrams = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i++) {
    bigrams.add(normalized.slice(i, i + 2));
  }
  return bigrams;
}

/**
 * Select diverse distractors: pick from ranked candidates ensuring they're not
 * too similar TO EACH OTHER (prevents 3 distractors that all mean the same thing).
 * Uses greedy selection with minimum inter-distractor distance.
 */
function selectDiverseDistractors<T>(
  ranked: Array<{ item: T; meaning: string }>,
  count: number,
  minDiversity = 0.6
): T[] {
  if (ranked.length <= count) return ranked.map((r) => r.item);

  const selected: Array<{ item: T; meaning: string }> = [];
  for (const candidate of ranked) {
    if (selected.length >= count) break;

    // Check diversity: candidate must be sufficiently different from already-selected
    const tooSimilar = selected.some(
      (s) => vietnameseSimilarity(s.meaning, candidate.meaning) > minDiversity
    );

    if (!tooSimilar) {
      selected.push(candidate);
    }
  }

  // If diversity constraint is too strict, relax and fill remaining slots
  if (selected.length < count) {
    for (const candidate of ranked) {
      if (selected.length >= count) break;
      if (!selected.includes(candidate)) {
        selected.push(candidate);
      }
    }
  }

  return selected.map((s) => s.item);
}

function uniqueLexemes<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function uniqueGrammarPoints<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function uniqueExamples<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
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
