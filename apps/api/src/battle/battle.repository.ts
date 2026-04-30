import { createPrismaClient, type Prisma } from "@nihongo-bjt/database";
import { shuffleDeterministic } from "@nihongo-bjt/shared";
import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";

const defaultMaxRounds = 5;

export type BattleQuestionPayload = {
  options: Array<{ isCorrect: boolean; optionKey: string; text: string }>;
  prompt: string;
  questionId: string;
  skillTag: string;
};

@Injectable()
export class BattleRepository {
  private readonly prisma = createPrismaClient();

  async abandonInProgressForUser(userId: string, reason: string) {
    await this.prisma.battleSession.updateMany({
      data: {
        abandonedReason: reason,
        completedAt: new Date(),
        status: "abandoned"
      },
      where: { status: "in_progress", userId }
    });
  }

  async createBotBattle(input: {
    botKey: string;
    fairnessSeed: string;
    maxRounds?: number;
    userId: string;
  }) {
    const maxRounds = input.maxRounds ?? defaultMaxRounds;
    const pool = await this.prisma.bjtQuestion.findMany({
      include: { options: { orderBy: { optionKey: "asc" } } },
      take: 200,
      where: {
        status: "published",
        section: { test: { status: "published" } }
      }
    });
    if (pool.length === 0) {
      throw new Error("BATTLE_NO_QUESTIONS");
    }
    const n = Math.min(maxRounds, pool.length);
    const picked = shuffleDeterministic(pool, input.fairnessSeed).slice(0, n);
    const roomCode = await this.makeUniqueRoomCode();
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.battleSession.create({
        data: {
          botKey: input.botKey,
          fairnessSeed: input.fairnessSeed,
          maxRounds: n,
          mode: "bot",
          roomCode,
          userId: input.userId
        }
      });
      const roundIds: string[] = [];
      for (const [i, q] of picked.entries()) {
        const created = await tx.battleRound.create({
          data: {
            questionId: q.id,
            roundIndex: i,
            sessionId: session.id
          }
        });
        roundIds.push(created.id);
      }
      const questions: BattleQuestionPayload[] = picked.map((q) => ({
        options: q.options.map((o) => ({
          isCorrect: o.isCorrect,
          optionKey: o.optionKey,
          text: o.text
        })),
        prompt: q.prompt,
        questionId: q.id,
        skillTag: q.skillTag
      }));
      return { questions, roomCode, roundIds, session };
    });
  }

  private async makeUniqueRoomCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = randomBytes(4).toString("hex");
      const exists = await this.prisma.battleSession.findUnique({ where: { roomCode: code } });
      if (!exists) {
        return code;
      }
    }
    return randomBytes(8).toString("hex").slice(0, 16);
  }

  listRecentForUser(userId: string, limit: number) {
    return this.prisma.battleSession.findMany({
      orderBy: { startedAt: "desc" },
      select: {
        botKey: true,
        completedAt: true,
        id: true,
        maxRounds: true,
        mode: true,
        opponentScore: true,
        roomCode: true,
        startedAt: true,
        status: true,
        userId: true,
        userScore: true
      },
      take: limit,
      where: { userId }
    });
  }

  markCompleted(
    sessionId: string,
    data: { opponentScore: number; userId: string; userScore: number }
  ) {
    return this.prisma.battleSession.update({
      data: {
        completedAt: new Date(),
        opponentScore: data.opponentScore,
        status: "completed",
        userScore: data.userScore
      },
      where: { id: sessionId, userId: data.userId }
    });
  }

  markAbandoned(sessionId: string, data: { reason: string; userId: string }) {
    return this.prisma.battleSession.update({
      data: {
        abandonedReason: data.reason,
        completedAt: new Date(),
        status: "abandoned"
      },
      where: { id: sessionId, userId: data.userId }
    });
  }

  getSessionForUser(sessionId: string, userId: string) {
    return this.prisma.battleSession.findFirst({
      where: { id: sessionId, userId }
    });
  }

  getSessionByRoom(roomCode: string) {
    return this.prisma.battleSession.findFirst({ where: { roomCode } });
  }

  getRoundBySessionAndIndex(sessionId: string, roundIndex: number) {
    return this.prisma.battleRound.findFirst({
      where: { roundIndex, sessionId }
    });
  }

  async updateRoundWithScores(input: {
    decidedAt: Date;
    newCurrentRoundIndex: number;
    nextOpponentScore: number;
    nextUserScore: number;
    roundId: string;
    sessionId: string;
    userId: string;
    userOptionKey: string | null;
    userCorrect: boolean;
    userResponseMs: number;
    botCorrect: boolean;
    botOptionKey: string;
    botResponseMs: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.battleSession.findFirst({
        where: { id: input.sessionId, userId: input.userId }
      });
      if (!session) {
        throw new Error("BATTLE_SESSION_NOT_FOUND");
      }
      const round = await tx.battleRound.update({
        data: {
          botCorrect: input.botCorrect,
          botOptionKey: input.botOptionKey,
          botResponseMs: input.botResponseMs,
          decidedAt: input.decidedAt,
          userCorrect: input.userCorrect,
          userOptionKey: input.userOptionKey,
          userResponseMs: input.userResponseMs
        },
        where: { id: input.roundId, sessionId: input.sessionId }
      });
      await tx.battleSession.update({
        data: {
          currentRoundIndex: input.newCurrentRoundIndex,
          opponentScore: input.nextOpponentScore,
          userScore: input.nextUserScore
        },
        where: { id: input.sessionId }
      });
      return round;
    });
  }

  createAnalyticsEvent(input: {
    eventName: string;
    payload: Record<string, unknown>;
    userId: string;
  }) {
    return this.prisma.analyticsEvent.create({
      data: {
        eventName: input.eventName,
        payload: input.payload as Prisma.InputJsonValue,
        source: "api",
        userId: input.userId
      }
    });
  }
}
