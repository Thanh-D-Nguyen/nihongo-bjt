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
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
