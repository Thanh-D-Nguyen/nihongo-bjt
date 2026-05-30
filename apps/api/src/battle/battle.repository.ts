import { createPrismaClient, type Prisma } from "@nihongo-bjt/database";
import {
  BATTLE_BOT_PROFILES,
  getBattleBotProfile,
  shuffleDeterministic,
  type BattleBotProfile
} from "@nihongo-bjt/shared";
import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";

const defaultMaxRounds = 5;
const autoRiveMetadataValues = new Set([
  "",
  "auto",
  "__auto__",
  "default",
  "__default__",
  "none",
  "__none__"
]);

export type BattleQuestionPayload = {
  audioScript: string | null;
  audioUrl: string | null;
  options: Array<{ isCorrect: boolean; optionKey: string; text: string }>;
  prompt: string;
  questionId: string;
  skillTag: string;
};

export type PlayableBattleBot = {
  accuracyPct: number;
  avatarFallback: string;
  botKey: string;
  difficulty: string;
  label: string;
  maxDelayMs: number;
  minDelayMs: number;
  persona: string | null;
  rive: BattleBotProfile["rive"];
  styleToken: BattleBotProfile["styleToken"];
  vocabularyLevel: string;
};

function normalizeRiveMetadata(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || autoRiveMetadataValues.has(trimmed.toLowerCase())) {
    return null;
  }
  return trimmed;
}

@Injectable()
export class BattleRepository {
  private readonly prisma = createPrismaClient();

  private dbBotToPlayable(row: {
    accuracyPct: number;
    avatarFallback: string;
    botKey: string;
    difficulty: string;
    maxDelayMs: number;
    minDelayMs: number;
    name: string;
    persona: string | null;
    riveArtboard: string;
    riveSrc: string | null;
    riveStateMachine: string;
    styleToken: string;
    vocabularyLevel: string;
  }): PlayableBattleBot {
    const registry = row.botKey in BATTLE_BOT_PROFILES ? getBattleBotProfile(row.botKey) : null;
    const styleToken =
      row.styleToken === "calm" || row.styleToken === "sharp" || row.styleToken === "focused"
        ? row.styleToken
        : (registry?.styleToken ?? "focused");
    return {
      accuracyPct: row.accuracyPct,
      avatarFallback: row.avatarFallback,
      botKey: row.botKey,
      difficulty: row.difficulty,
      label: row.name,
      maxDelayMs: row.maxDelayMs,
      minDelayMs: row.minDelayMs,
      persona: row.persona,
      rive: {
        artboard: normalizeRiveMetadata(row.riveArtboard) ?? registry?.rive.artboard ?? null,
        src: row.riveSrc ?? registry?.rive.src ?? null,
        stateMachine:
          normalizeRiveMetadata(row.riveStateMachine) ?? registry?.rive.stateMachine ?? null
      },
      styleToken,
      vocabularyLevel: row.vocabularyLevel
    };
  }

  private registryBotToPlayable(botKey: string): PlayableBattleBot {
    const profile = getBattleBotProfile(botKey);
    const difficulty =
      botKey === "bot_j2" ? "easy" : botKey === "bot_j1" || botKey === "bot_j4" ? "hard" : "medium";
    const vocabularyLevel =
      botKey === "bot_j1" || botKey === "bot_j4"
        ? "bjt_advanced"
        : botKey === "bot_j2"
          ? "bjt_basic"
          : "bjt_intermediate";
    return {
      accuracyPct: Math.round(profile.correctProbability * 100),
      avatarFallback: profile.avatarFallback,
      botKey,
      difficulty,
      label: profile.labelI18nKey,
      maxDelayMs: profile.maxDelayMs,
      minDelayMs: profile.minDelayMs,
      persona: profile.personaI18nKey,
      rive: profile.rive,
      styleToken: profile.styleToken,
      vocabularyLevel
    };
  }

  async listPlayableBots(): Promise<PlayableBattleBot[]> {
    const rows = await this.prisma.battleBot.findMany({
      orderBy: [{ difficulty: "asc" }, { updatedAt: "desc" }],
      select: {
        accuracyPct: true,
        avatarFallback: true,
        botKey: true,
        difficulty: true,
        maxDelayMs: true,
        minDelayMs: true,
        name: true,
        persona: true,
        riveArtboard: true,
        riveSrc: true,
        riveStateMachine: true,
        styleToken: true,
        vocabularyLevel: true
      },
      where: { status: "active" }
    });
    if (rows.length > 0) {
      return rows.map((row) => this.dbBotToPlayable(row));
    }
    return Object.keys(BATTLE_BOT_PROFILES).map((botKey) => this.registryBotToPlayable(botKey));
  }

  async getPlayableBot(botKey: string): Promise<PlayableBattleBot | null> {
    const row = await this.prisma.battleBot.findFirst({
      select: {
        accuracyPct: true,
        avatarFallback: true,
        botKey: true,
        difficulty: true,
        maxDelayMs: true,
        minDelayMs: true,
        name: true,
        persona: true,
        riveArtboard: true,
        riveSrc: true,
        riveStateMachine: true,
        styleToken: true,
        vocabularyLevel: true
      },
      where: { botKey, status: "active" }
    });
    if (row) {
      return this.dbBotToPlayable(row);
    }
    return botKey in BATTLE_BOT_PROFILES ? this.registryBotToPlayable(botKey) : null;
  }

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
        audioScript: q.audioScript ?? null,
        audioUrl: q.audioUrl ?? null,
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

  /** Per-learner battle record from `battle_session`, including PvP when the player was `opponent_user_id`. */
  async learnerBattleStats(userId: string) {
    type Row = {
      botCompleted: number;
      botDraws: number;
      botLosses: number;
      botWins: number;
      completedMatches: number;
      draws: number;
      losses: number;
      pvpCompleted: number;
      pvpDraws: number;
      pvpLosses: number;
      pvpWins: number;
      wins: number;
    };
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed')::int AS "completedMatches",
        COUNT(*) FILTER (
          WHERE status = 'completed' AND (
            (user_id = ${userId}::uuid AND user_score > opponent_score)
            OR (opponent_user_id = ${userId}::uuid AND mode = 'pvp' AND opponent_score > user_score)
          )
        )::int AS wins,
        COUNT(*) FILTER (
          WHERE status = 'completed' AND (
            (user_id = ${userId}::uuid AND user_score < opponent_score)
            OR (opponent_user_id = ${userId}::uuid AND mode = 'pvp' AND opponent_score < user_score)
          )
        )::int AS losses,
        COUNT(*) FILTER (
          WHERE status = 'completed' AND (
            (user_id = ${userId}::uuid AND user_score = opponent_score)
            OR (opponent_user_id = ${userId}::uuid AND mode = 'pvp' AND user_score = opponent_score)
          )
        )::int AS draws,
        COUNT(*) FILTER (WHERE status = 'completed' AND mode = 'pvp')::int AS "pvpCompleted",
        COUNT(*) FILTER (
          WHERE status = 'completed' AND mode = 'pvp' AND (
            (user_id = ${userId}::uuid AND user_score > opponent_score)
            OR (opponent_user_id = ${userId}::uuid AND opponent_score > user_score)
          )
        )::int AS "pvpWins",
        COUNT(*) FILTER (
          WHERE status = 'completed' AND mode = 'pvp' AND (
            (user_id = ${userId}::uuid AND user_score < opponent_score)
            OR (opponent_user_id = ${userId}::uuid AND opponent_score < user_score)
          )
        )::int AS "pvpLosses",
        COUNT(*) FILTER (
          WHERE status = 'completed' AND mode = 'pvp' AND (
            (user_id = ${userId}::uuid AND user_score = opponent_score)
            OR (opponent_user_id = ${userId}::uuid AND user_score = opponent_score)
          )
        )::int AS "pvpDraws",
        COUNT(*) FILTER (WHERE status = 'completed' AND mode = 'bot' AND user_id = ${userId}::uuid)::int AS "botCompleted",
        COUNT(*) FILTER (
          WHERE status = 'completed' AND mode = 'bot' AND user_id = ${userId}::uuid AND user_score > opponent_score
        )::int AS "botWins",
        COUNT(*) FILTER (
          WHERE status = 'completed' AND mode = 'bot' AND user_id = ${userId}::uuid AND user_score < opponent_score
        )::int AS "botLosses",
        COUNT(*) FILTER (
          WHERE status = 'completed' AND mode = 'bot' AND user_id = ${userId}::uuid AND user_score = opponent_score
        )::int AS "botDraws"
      FROM learning.battle_session
      WHERE user_id = ${userId}::uuid OR (opponent_user_id = ${userId}::uuid AND mode = 'pvp')
    `;

    const r = rows[0] ?? {
      botCompleted: 0,
      botDraws: 0,
      botLosses: 0,
      botWins: 0,
      completedMatches: 0,
      draws: 0,
      losses: 0,
      pvpCompleted: 0,
      pvpDraws: 0,
      pvpLosses: 0,
      pvpWins: 0,
      wins: 0
    };

    const completed = r.completedMatches;
    const wins = r.wins;
    const winRatePct =
      completed > 0 ? Number(((wins / completed) * 100).toFixed(1)) : 0;
    const wr = completed > 0 ? wins / completed : 0;

    return {
      bot: {
        completed: r.botCompleted,
        draws: r.botDraws,
        losses: r.botLosses,
        wins: r.botWins
      },
      completedMatches: completed,
      draws: r.draws,
      losses: r.losses,
      milestones: [
        { key: "first_win" as const, unlocked: wins >= 1 },
        { key: "battler_10" as const, unlocked: completed >= 10 },
        { key: "pvp_contender" as const, unlocked: r.pvpCompleted >= 1 },
        { key: "steady_60" as const, unlocked: completed >= 5 && wr >= 0.6 }
      ],
      pvp: {
        completed: r.pvpCompleted,
        draws: r.pvpDraws,
        losses: r.pvpLosses,
        wins: r.pvpWins
      },
      winRatePct,
      wins
    };
  }

  /** Compact battle record for lobby popovers (no milestones; any peer learner can view). */
  async battleStatsCompactPublic(userId: string) {
    const s = await this.learnerBattleStats(userId);
    return {
      completedMatches: s.completedMatches,
      draws: s.draws,
      losses: s.losses,
      winRatePct: s.winRatePct,
      wins: s.wins
    };
  }

  async listRecentChatMessages(input: { limit: number; roomKey: string }) {
    const rows = await this.prisma.battleChatMessage.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        displayName: true,
        id: true,
        kind: true,
        message: true,
        metadata: true,
        roomKey: true,
        userId: true
      },
      take: input.limit,
      where: { moderationState: "visible", roomKey: input.roomKey }
    });
    return rows.reverse();
  }

  /** Published configs available for learners — within schedule window or no schedule set */
  async listPublishedConfigs() {
    const now = new Date();
    const rows = await this.prisma.battleConfig.findMany({
      orderBy: [{ scheduleStart: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        description: true,
        level: true,
        questionPoolKey: true,
        questionCount: true,
        timePerQuestionSec: true,
        maxParticipants: true,
        botDifficulties: true,
        scoringRules: true,
        scheduleStart: true,
        scheduleEnd: true,
        publishedAt: true
      },
      where: {
        status: "published",
        OR: [
          { scheduleStart: null },
          { scheduleStart: { lte: now }, scheduleEnd: null },
          { scheduleStart: { lte: now }, scheduleEnd: { gte: now } },
          { scheduleStart: { gt: now } } // upcoming — show but mark as scheduled
        ]
      }
    });
    return rows.map((r) => {
      const scoring = r.scoringRules as Record<string, unknown> | null;
      return {
        ...r,
        gameType: (scoring?.gameType as string) ?? "speed_duel",
        isUpcoming: r.scheduleStart ? r.scheduleStart > now : false,
        isActive: !r.scheduleStart || (r.scheduleStart <= now && (!r.scheduleEnd || r.scheduleEnd >= now))
      };
    });
  }

  /** Get a single published config by ID (for match params resolution) */
  async getPublishedConfig(id: string) {
    const row = await this.prisma.battleConfig.findFirst({
      select: {
        id: true,
        questionCount: true,
        timePerQuestionSec: true,
        maxParticipants: true,
        botDifficulties: true,
        scoringRules: true
      },
      where: { id, status: "published" }
    });
    if (!row) return null;
    const scoring = row.scoringRules as Record<string, unknown> | null;
    return {
      ...row,
      gameType: (scoring?.gameType as string) ?? "speed_duel"
    };
  }

  createChatMessage(input: {
    displayName?: string | null;
    kind?: string;
    message: string;
    metadata?: Record<string, unknown>;
    roomKey: string;
    userId: string;
  }) {
    return this.prisma.battleChatMessage.create({
      data: {
        displayName: input.displayName?.slice(0, 120) ?? null,
        kind: input.kind ?? "chat",
        message: input.message.slice(0, 500),
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        roomKey: input.roomKey,
        userId: input.userId
      },
      select: {
        createdAt: true,
        displayName: true,
        id: true,
        kind: true,
        message: true,
        metadata: true,
        roomKey: true,
        userId: true
      }
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

  async createPvpBattle(input: {
    fairnessSeed: string;
    maxRounds?: number;
    opponentUserId: string;
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
          fairnessSeed: input.fairnessSeed,
          maxRounds: n,
          mode: "pvp",
          opponentUserId: input.opponentUserId,
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
        audioScript: q.audioScript ?? null,
        audioUrl: q.audioUrl ?? null,
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

  async updatePvpRoundWithScores(input: {
    decidedAt: Date;
    newCurrentRoundIndex: number;
    nextOpponentScore: number;
    nextUserScore: number;
    opponentCorrect: boolean;
    opponentOptionKey: string | null;
    opponentResponseMs: number;
    roundId: string;
    sessionId: string;
    userId: string;
    userCorrect: boolean;
    userOptionKey: string | null;
    userResponseMs: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.battleSession.findFirst({
        where: { id: input.sessionId }
      });
      if (!session) {
        throw new Error("BATTLE_SESSION_NOT_FOUND");
      }
      const round = await tx.battleRound.update({
        data: {
          decidedAt: input.decidedAt,
          opponentCorrect: input.opponentCorrect,
          opponentOptionKey: input.opponentOptionKey,
          opponentResponseMs: input.opponentResponseMs,
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

  markPvpCompleted(
    sessionId: string,
    data: { opponentScore: number; userScore: number }
  ) {
    return this.prisma.battleSession.update({
      data: {
        completedAt: new Date(),
        opponentScore: data.opponentScore,
        status: "completed",
        userScore: data.userScore
      },
      where: { id: sessionId }
    });
  }
}
