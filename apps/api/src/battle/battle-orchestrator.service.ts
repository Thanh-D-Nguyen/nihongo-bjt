import { BATTLE_BOT_PROFILES, decideBotOption, getBattleBotProfile, randomBetween } from "@nihongo-bjt/shared";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { Socket } from "socket.io";

import type { BattleQuestionPayload } from "./battle.repository.js";
import { BattleRepository } from "./battle.repository.js";
import { MatchmakingPort } from "./matchmaking.port.js";

const roundTimeMs = 45_000;
const suspiciousAnswerThresholdMs = 250;
const invalidAnswerStrikeLimit = 3;

type RoomState = {
  botKey: string;
  idempotency: Set<string>;
  maxRounds: number;
  opponentScore: number;
  questions: BattleQuestionPayload[];
  roundIds: string[];
  roomCode: string;
  roundTimer: NodeJS.Timeout | null;
  roundStartMs: number;
  sessionId: string;
  state: "countdown" | "finished" | "question" | "resolving";
  missedSkillTagCounts: Map<string, number>;
  invalidAnswerStrikes: number;
  userId: string;
  userScore: number;
  /** 0-based index of the current question */
  whichRound: number;
};

@Injectable()
export class BattleOrchestratorService {
  private readonly userActiveRoom = new Map<string, string>();
  private readonly rooms = new Map<string, RoomState>();
  private readonly socketToRoom = new Map<string, string>();

  constructor(
    @Inject(BattleRepository) private readonly battleRepository: BattleRepository,
    @Inject(MatchmakingPort) private readonly matchmaking: MatchmakingPort
  ) {}

  onDisconnect(socketId: string) {
    const code = this.socketToRoom.get(socketId);
    if (!code) {
      return;
    }
    this.socketToRoom.delete(socketId);
    const room = this.rooms.get(code);
    if (!room || room.state === "finished") {
      this.rooms.delete(code);
      if (room?.userId) {
        this.userActiveRoom.delete(room.userId);
      }
      return;
    }
    void this.abandonRoom(code, "user_disconnect");
  }

  private async abandonRoom(roomCode: string, reason: string) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return;
    }
    this.clearRoundTimer(room);
    try {
      await this.battleRepository.markAbandoned(room.sessionId, { reason, userId: room.userId });
      await this.battleRepository.createAnalyticsEvent({
        eventName: "battle_match_abandoned",
        payload: {
          opponentScore: room.opponentScore,
          roomCode,
          sessionId: room.sessionId,
          userScore: room.userScore
        },
        userId: room.userId
      });
    } catch {
      /* best effort */
    }
    this.rooms.delete(roomCode);
    this.userActiveRoom.delete(room.userId);
  }

  private clearRoundTimer(room: RoomState) {
    if (room.roundTimer) {
      clearTimeout(room.roundTimer);
      room.roundTimer = null;
    }
  }

  private correctKey(q: BattleQuestionPayload) {
    return q.options.find((o) => o.isCorrect)?.optionKey;
  }

  private safeOptionsForClient(q: BattleQuestionPayload) {
    return q.options.map((o) => ({ optionKey: o.optionKey, text: o.text }));
  }

  private async registerInvalidAnswerAttempt(input: {
    client: Socket;
    detail: Record<string, unknown>;
    reason: string;
    room: RoomState;
  }) {
    const { client, detail, reason, room } = input;
    room.invalidAnswerStrikes = (room.invalidAnswerStrikes ?? 0) + 1;
    try {
      await this.battleRepository.createAnalyticsEvent({
        eventName: "battle_answer_rejected",
        payload: {
          reason,
          roomCode: room.roomCode,
          roundIndex: room.whichRound,
          sessionId: room.sessionId,
          strikes: room.invalidAnswerStrikes,
          ...detail
        },
        userId: room.userId
      });
    } catch {
      /* best effort */
    }
    if (room.invalidAnswerStrikes < invalidAnswerStrikeLimit) {
      return;
    }
    try {
      await this.battleRepository.createAnalyticsEvent({
        eventName: "battle_abuse_detected",
        payload: {
          reason,
          roomCode: room.roomCode,
          sessionId: room.sessionId,
          strikeLimit: invalidAnswerStrikeLimit,
          strikes: room.invalidAnswerStrikes
        },
        userId: room.userId
      });
    } catch {
      /* best effort */
    }
    await this.abandonRoom(room.roomCode, "anti_abuse_threshold");
    client.emit("battle:error", { code: "abuse_detected" });
  }

  private topMissedSkillTags(room: RoomState, limit = 3) {
    return Array.from(room.missedSkillTagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([skillTag]) => skillTag);
  }

  async startBotBattle(client: Socket, input: { botKey: string; userId: string }) {
    if (!(input.botKey in BATTLE_BOT_PROFILES)) {
      throw new BadRequestException("invalid_bot_key");
    }
    this.matchmaking.releaseUser(input.userId);
    const previous = this.userActiveRoom.get(input.userId);
    if (previous) {
      await this.abandonRoom(previous, "replaced");
    }
    await this.battleRepository.abandonInProgressForUser(input.userId, "replaced");
    const fairnessSeed = randomBytes(16).toString("hex");
    let created: Awaited<ReturnType<BattleRepository["createBotBattle"]>>;
    try {
      created = await this.battleRepository.createBotBattle({
        botKey: input.botKey,
        fairnessSeed,
        userId: input.userId
      });
    } catch (e) {
      if (e instanceof Error && e.message === "BATTLE_NO_QUESTIONS") {
        throw new BadRequestException("No published questions available for battle");
      }
      throw e;
    }
    const roomCode = created.roomCode;
    const room: RoomState = {
      botKey: input.botKey,
      idempotency: new Set(),
      maxRounds: created.questions.length,
      opponentScore: 0,
      questions: created.questions,
      roundIds: created.roundIds,
      roomCode,
      roundStartMs: 0,
      roundTimer: null,
      sessionId: created.session.id,
      state: "countdown",
      missedSkillTagCounts: new Map<string, number>(),
      invalidAnswerStrikes: 0,
      userId: input.userId,
      userScore: 0,
      whichRound: 0
    };
    this.rooms.set(roomCode, room);
    this.userActiveRoom.set(input.userId, roomCode);
    this.socketToRoom.set(client.id, roomCode);
    const profile = getBattleBotProfile(input.botKey);
    await this.battleRepository.createAnalyticsEvent({
      eventName: "battle_match_started",
      payload: { botKey: input.botKey, mode: "bot", roomCode, sessionId: room.sessionId },
      userId: input.userId
    });
    void client.join(`battle:${roomCode}`);
    client.emit("battle:match_found", {
      bot: { key: input.botKey, labelI18nKey: profile.labelI18nKey },
      maxRounds: room.maxRounds,
      roomCode,
      sessionId: room.sessionId
    });
    void this.runCountdownThenRounds(client, roomCode);
    return { roomCode };
  }

  private async runCountdownThenRounds(client: Socket, roomCode: string) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return;
    }
    for (const value of [3, 2, 1]) {
      if (!this.rooms.get(roomCode)) {
        return;
      }
      client.emit("battle:countdown", { value });
      await new Promise((r) => {
        setTimeout(r, 700);
      });
    }
    this.beginRound(client, roomCode);
  }

  private beginRound(client: Socket, roomCode: string) {
    const room = this.rooms.get(roomCode);
    if (!room || room.state === "finished") {
      return;
    }
    if (room.whichRound >= room.maxRounds) {
      return;
    }
    room.state = "question";
    room.roundStartMs = Date.now();
    const q = room.questions[room.whichRound]!;
    this.clearRoundTimer(room);
    const expectRound = room.whichRound;
    room.roundTimer = setTimeout(() => {
      const current = this.rooms.get(roomCode);
      if (!current || current.whichRound !== expectRound || current.state !== "question") {
        return;
      }
      void this.settleRound(client, roomCode, { timeout: true });
    }, roundTimeMs);
    client.emit("battle:question", {
      roundIndex: room.whichRound,
      roomCode,
      timeLimitSec: 45,
      totalRounds: room.maxRounds,
      question: {
        options: this.safeOptionsForClient(q),
        prompt: q.prompt,
        questionId: q.questionId,
        skillTag: q.skillTag
      }
    });
  }

  async submitAnswer(
    client: Socket,
    input: {
      idempotencyKey: string;
      optionKey: string;
      roomCode: string;
      roundIndex: number;
      userId: string;
    }
  ) {
    return this.settleRound(client, input.roomCode, {
      idempotencyKey: input.idempotencyKey,
      optionKey: input.optionKey,
      roundIndex: input.roundIndex,
      timeout: false,
      userId: input.userId
    });
  }

  private async settleRound(
    client: Socket,
    roomCode: string,
    params:
      | {
          idempotencyKey: string;
          optionKey: string;
          roundIndex: number;
          timeout: false;
          userId: string;
        }
      | { timeout: true }
  ) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return;
    }
    if (room.state === "finished" || room.state === "resolving" || room.state === "countdown") {
      return;
    }
    if (room.state !== "question") {
      return;
    }
    if (!params.timeout) {
      if (params.userId !== room.userId) {
        await this.registerInvalidAnswerAttempt({
          client,
          detail: { providedUserId: params.userId },
          reason: "user_mismatch",
          room
        });
        throw new BadRequestException("user_mismatch");
      }
      if (params.roundIndex !== room.whichRound) {
        await this.registerInvalidAnswerAttempt({
          client,
          detail: { providedRoundIndex: params.roundIndex },
          reason: "round_mismatch",
          room
        });
        throw new BadRequestException("round_mismatch");
      }
    }
    const q = room.questions[room.whichRound]!;
    if (!params.timeout) {
      const isKnownOption = q.options.some((option) => option.optionKey === params.optionKey);
      if (!isKnownOption) {
        await this.registerInvalidAnswerAttempt({
          client,
          detail: { providedOptionKey: params.optionKey },
          reason: "option_mismatch",
          room
        });
        throw new BadRequestException("option_mismatch");
      }
      const idk = `${params.roundIndex}-${params.idempotencyKey}`;
      if (room.idempotency.has(idk)) {
        return;
      }
      room.idempotency.add(idk);
    }
    room.state = "resolving";
    this.clearRoundTimer(room);
    const correct = this.correctKey(q);
    if (!correct) {
      room.state = "question";
      return;
    }
    try {
      const now = Date.now();
      let userResponseMs: number;
      let userOptionKey: string | null;
      let userCorrect: boolean;
      if (params.timeout) {
        userResponseMs = roundTimeMs;
        userOptionKey = null;
        userCorrect = false;
      } else {
        userResponseMs = Math.max(0, Math.min(roundTimeMs, now - room.roundStartMs));
        userOptionKey = params.optionKey;
        userCorrect = params.optionKey === correct;
        if (userResponseMs <= suspiciousAnswerThresholdMs) {
          await this.battleRepository.createAnalyticsEvent({
            eventName: "battle_answer_suspicious_speed",
            payload: {
              responseMs: userResponseMs,
              roomCode,
              roundIndex: room.whichRound,
              sessionId: room.sessionId,
              thresholdMs: suspiciousAnswerThresholdMs
            },
            userId: room.userId
          });
        }
      }
      const profile = getBattleBotProfile(room.botKey);
      const rng = Math.random;
      const optionKeys = q.options.map((o) => o.optionKey);
      const botDelay = randomBetween(rng, profile.minDelayMs, profile.maxDelayMs);
      await new Promise((r) => {
        setTimeout(r, botDelay);
      });
      const bot = decideBotOption({
        correctOptionKey: correct,
        correctProbability: profile.correctProbability,
        optionKeys,
        random: rng
      });
      const botCorrect = bot.optionKey === correct;
      const userDelta = userCorrect ? 1 : 0;
      const botDelta = botCorrect ? 1 : 0;
      const nextUser = room.userScore + userDelta;
      const nextOp = room.opponentScore + botDelta;
      const roundId = room.roundIds[room.whichRound]!;
      const decidedAt = new Date();
      await this.battleRepository.updateRoundWithScores({
        botCorrect,
        botOptionKey: bot.optionKey,
        botResponseMs: botDelay,
        decidedAt,
        newCurrentRoundIndex: room.whichRound + 1,
        nextOpponentScore: nextOp,
        nextUserScore: nextUser,
        roundId,
        sessionId: room.sessionId,
        userId: room.userId,
        userCorrect,
        userOptionKey,
        userResponseMs
      });
      if (!userCorrect) {
        room.missedSkillTagCounts.set(q.skillTag, (room.missedSkillTagCounts.get(q.skillTag) ?? 0) + 1);
      }
      room.userScore = nextUser;
      room.opponentScore = nextOp;
      client.emit("battle:answer_result", {
        botCorrect,
        correctOptionKey: correct,
        roundIndex: room.whichRound,
        userCorrect
      });
      client.emit("battle:score_update", { opponentScore: nextOp, userScore: nextUser });
      const lastRound = room.whichRound === room.maxRounds - 1;
      room.whichRound += 1;
      if (lastRound) {
        room.state = "finished";
        this.clearRoundTimer(room);
        await this.battleRepository.markCompleted(room.sessionId, {
          opponentScore: nextOp,
          userId: room.userId,
          userScore: nextUser
        });
        const outcome = nextUser > nextOp ? "win" : nextUser < nextOp ? "lose" : "draw";
        const focusSkillTags = outcome === "lose" ? this.topMissedSkillTags(room) : [];
        await this.battleRepository.createAnalyticsEvent({
          eventName: "battle_match_completed",
          payload: {
            focusSkillTags,
            opponentScore: nextOp,
            outcome,
            roomCode,
            sessionId: room.sessionId,
            userScore: nextUser
          },
          userId: room.userId
        });
        client.emit("battle:finished", {
          remediation:
            outcome === "lose"
              ? {
                  ctaPath: "flashcards",
                  focusSkillTags,
                  kind: "review_queue",
                  summaryI18nKey: "battle.remediation.loss_focus"
                }
              : null,
          outcome,
          sessionId: room.sessionId
        });
        this.rooms.delete(roomCode);
        this.userActiveRoom.delete(room.userId);
        this.socketToRoom.delete(client.id);
      } else {
        room.state = "countdown";
        for (const value of [3, 2, 1]) {
          if (!this.rooms.get(roomCode)) {
            return;
          }
          client.emit("battle:countdown", { value });
          await new Promise((r) => {
            setTimeout(r, 400);
          });
        }
        this.beginRound(client, roomCode);
      }
    } catch (error) {
      room.state = "question";
      throw error;
    }
  }
}
