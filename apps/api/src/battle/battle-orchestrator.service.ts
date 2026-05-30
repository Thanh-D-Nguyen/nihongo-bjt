import { decideBotOption, randomBetween, type BattleBotAnimationState } from "@nihongo-bjt/shared";
import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { Namespace, Socket } from "socket.io";

import type { BattleQuestionPayload, PlayableBattleBot } from "./battle.repository.js";
import { BattleRepository } from "./battle.repository.js";
import { generateBattleCommentary, type CommentaryContext, type CommentaryTrigger } from "./bot-battle-commentary.js";
import { BotChatResponderPort } from "./bot-chat-responder.port.js";
import { MatchmakingPort } from "./matchmaking.port.js";
import { PresenceGateway } from "../presence/presence.gateway.js";

const roundTimeMs = 45_000;
const suspiciousAnswerThresholdMs = 250;
const invalidAnswerStrikeLimit = 3;
const lobbyChatWindowMs = 10_000;
const lobbyChatWindowLimit = 5;
const pvpRoundTimeMs = 45_000;
const challengeExpiryMs = 60_000;
/** When all sockets for a PvP room disconnect, abandon after this grace period */
const pvpReconnectGraceMs = 120_000;
/** If one player disconnects but the other stays, award a win after this if absent player never returns */
const pvpOpponentAbsentWinMs = 45_000;

type RoomState = {
  botKey: string;
  botProfile: PlayableBattleBot;
  configTimeSec: number;
  gameType: string;
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
  /** Commentary state */
  userCorrectStreak: number;
  botCorrectStreak: number;
  lastCommentRound: number;
};

type PvpRoomState = {
  gameType: string;
  idempotency: Set<string>;
  maxRounds: number;
  opponentDisplayName: string;
  opponentScore: number;
  opponentUserId: string;
  questions: BattleQuestionPayload[];
  roomCode: string;
  roundIds: string[];
  roundStartMs: number;
  roundTimer: NodeJS.Timeout | null;
  sessionId: string;
  state: "countdown" | "finished" | "question" | "resolving";
  userDisplayName: string;
  userId: string;
  userScore: number;
  whichRound: number;
  /** Answers received for current round: userId -> { optionKey, responseMs } */
  roundAnswers: Map<string, { optionKey: string; responseMs: number }>;
  /** Fired when no players are connected, until they reconnect or grace elapses */
  abandonAfterDisconnectTimer: NodeJS.Timeout | null;
  /** When one socket remains, award win if absent user does not return */
  opponentAbsentWinTimer: NodeJS.Timeout | null;
  opponentAbsentUserId: string | null;
};

type PendingChallenge = {
  challengeId: string;
  createdAt: number;
  fromDisplayName: string | null;
  fromUserId: string;
  targetUserId: string;
};

type LobbyPresence = {
  displayName: string | null;
  joinedAt: string;
  socketId: string;
  userId: string;
};

@Injectable()
export class BattleOrchestratorService {
  private readonly logger = new Logger(BattleOrchestratorService.name);
  private readonly userActiveRoom = new Map<string, string>();
  private readonly rooms = new Map<string, RoomState>();
  private readonly pvpRooms = new Map<string, PvpRoomState>();
  private readonly pendingChallenges = new Map<string, PendingChallenge>();
  private readonly userToPvpRoom = new Map<string, string>();
  private readonly socketToRoom = new Map<string, string>();
  private readonly socketToPvpRoom = new Map<string, string>();
  private readonly socketToLobbyUser = new Map<string, string>();
  private readonly lobbyUsers = new Map<string, LobbyPresence>();
  private readonly lobbyMessageWindows = new Map<string, number[]>();

  /** Tracks the bot key for the current lobby (used for bot chat responses) */
  private lobbyActiveBotKey = "bot_j3";

  /** Stable namespace reference set by gateway afterInit — used for bot broadcast */
  private nsp: Namespace | null = null;

  constructor(
    @Inject(BattleRepository) private readonly battleRepository: BattleRepository,
    @Inject(MatchmakingPort) private readonly matchmaking: MatchmakingPort,
    @Inject(BotChatResponderPort) private readonly botResponder: BotChatResponderPort,
    @Inject(PresenceGateway) private readonly presenceGateway: PresenceGateway
  ) {}

  /** Called by BattleGateway.afterInit to provide a stable namespace reference */
  setNamespace(nsp: Namespace) {
    this.nsp = nsp;
  }

  onDisconnect(socketId: string) {
    const lobbyUserId = this.socketToLobbyUser.get(socketId) ?? null;
    this.leaveLobby(socketId);

    // Handle bot battle disconnect
    const code = this.socketToRoom.get(socketId);
    if (code) {
      this.socketToRoom.delete(socketId);
      const room = this.rooms.get(code);
      if (!room || room.state === "finished") {
        this.rooms.delete(code);
        if (room?.userId) {
          this.userActiveRoom.delete(room.userId);
        }
      } else {
        void this.abandonRoom(code, "user_disconnect");
      }
    }

    // PvP: socket dropped — allow reconnect; orphan abandon; or award win if one side stays alone
    const pvpCode = this.socketToPvpRoom.get(socketId);
    if (pvpCode) {
      this.socketToPvpRoom.delete(socketId);
      const remaining = this.countSocketsForPvpRoom(pvpCode);
      if (remaining === 0) {
        const pvpRoom = this.pvpRooms.get(pvpCode);
        if (pvpRoom) this.clearPvpOpponentAbsentTimer(pvpRoom);
        this.schedulePvpAbandonIfOrphaned(pvpCode);
      } else if (remaining === 1 && lobbyUserId) {
        this.schedulePvpWinIfOpponentAbsent(pvpCode, lobbyUserId);
      }
    }
  }

  private emitLobbyPresence(client: Socket) {
    client.nsp.to("battle:lobby:global").emit("battle:lobby_presence", {
      users: Array.from(this.lobbyUsers.values()).map((user) => ({
        displayName: user.displayName,
        joinedAt: user.joinedAt,
        userId: user.userId
      }))
    });
  }

  private leaveLobby(socketId: string) {
    const userId = this.socketToLobbyUser.get(socketId);
    if (!userId) {
      return;
    }
    this.socketToLobbyUser.delete(socketId);
    const current = this.lobbyUsers.get(userId);
    if (current?.socketId === socketId) {
      this.lobbyUsers.delete(userId);
    }
  }

  private countSocketsForPvpRoom(roomCode: string): number {
    let n = 0;
    for (const code of this.socketToPvpRoom.values()) {
      if (code === roomCode) n += 1;
    }
    return n;
  }

  private clearPvpDisconnectTimer(pvpRoom: PvpRoomState) {
    if (pvpRoom.abandonAfterDisconnectTimer) {
      clearTimeout(pvpRoom.abandonAfterDisconnectTimer);
      pvpRoom.abandonAfterDisconnectTimer = null;
    }
  }

  private schedulePvpAbandonIfOrphaned(roomCode: string) {
    const pvpRoom = this.pvpRooms.get(roomCode);
    if (!pvpRoom || pvpRoom.state === "finished") return;
    if (this.countSocketsForPvpRoom(roomCode) > 0) return;
    this.clearPvpDisconnectTimer(pvpRoom);
    pvpRoom.abandonAfterDisconnectTimer = setTimeout(() => {
      pvpRoom.abandonAfterDisconnectTimer = null;
      void this.abandonPvpRoom(roomCode, "reconnect_timeout");
    }, pvpReconnectGraceMs);
  }

  private clearPvpOpponentAbsentTimer(pvpRoom: PvpRoomState) {
    if (pvpRoom.opponentAbsentWinTimer) {
      clearTimeout(pvpRoom.opponentAbsentWinTimer);
      pvpRoom.opponentAbsentWinTimer = null;
    }
    pvpRoom.opponentAbsentUserId = null;
  }

  private schedulePvpWinIfOpponentAbsent(roomCode: string, departedUserId: string) {
    const pvpRoom = this.pvpRooms.get(roomCode);
    if (!pvpRoom || pvpRoom.state === "finished") return;
    this.clearPvpOpponentAbsentTimer(pvpRoom);
    pvpRoom.opponentAbsentUserId = departedUserId;
    pvpRoom.opponentAbsentWinTimer = setTimeout(() => {
      pvpRoom.opponentAbsentWinTimer = null;
      void this.tryAwardPvpWinForAbsentOpponent(roomCode, departedUserId);
    }, pvpOpponentAbsentWinMs);
  }

  private async tryAwardPvpWinForAbsentOpponent(roomCode: string, departedUserId: string) {
    const pvpRoom = this.pvpRooms.get(roomCode);
    if (!pvpRoom || pvpRoom.state === "finished") return;
    if (this.countSocketsForPvpRoom(roomCode) !== 1) return;
    const returned = this.findSocketForUser(departedUserId);
    if (returned) return;
    await this.abandonPvpRoom(roomCode, "opponent_disconnect", { forfeitingUserId: departedUserId });
  }

  private emitPvpResync(client: Socket, pvpRoom: PvpRoomState, viewerUserId: string) {
    const isAcceptor = viewerUserId === pvpRoom.userId;
    const opponentDisplayName = isAcceptor
      ? pvpRoom.opponentDisplayName
      : pvpRoom.userDisplayName;
    const userScore = isAcceptor ? pvpRoom.userScore : pvpRoom.opponentScore;
    const opponentScore = isAcceptor ? pvpRoom.opponentScore : pvpRoom.userScore;

    let question: {
	      question: {
	        audioScript: string | null;
	        audioUrl: string | null;
	        options: Array<{ optionKey: string; text: string }>;
	        prompt: string;
	        skillTag: string;
      };
      roomCode: string;
      roundIndex: number;
      timeLimitSec: number;
      totalRounds: number;
    } | null = null;
    let timeLeftSec: number | null = null;
    let showCountdownOverlay = false;
    let settlingRound = false;

    if (pvpRoom.state === "question") {
      const q = pvpRoom.questions[pvpRoom.whichRound];
      if (q) {
        question = {
          question: {
            audioScript: q.audioScript ?? null,
            audioUrl: q.audioUrl ?? null,
            options: this.safeOptionsForClient(q),
            prompt: q.prompt,
            skillTag: q.skillTag
          },
          roomCode: pvpRoom.roomCode,
          roundIndex: pvpRoom.whichRound,
          timeLimitSec: Math.round(pvpRoundTimeMs / 1000),
          totalRounds: pvpRoom.maxRounds
        };
        timeLeftSec = Math.max(
          0,
          Math.ceil((pvpRoom.roundStartMs + pvpRoundTimeMs - Date.now()) / 1000)
        );
      }
    } else if (pvpRoom.state === "resolving") {
      settlingRound = true;
      const q = pvpRoom.questions[pvpRoom.whichRound];
      if (q) {
        question = {
          question: {
            audioScript: q.audioScript ?? null,
            audioUrl: q.audioUrl ?? null,
            options: this.safeOptionsForClient(q),
            prompt: q.prompt,
            skillTag: q.skillTag
          },
          roomCode: pvpRoom.roomCode,
          roundIndex: pvpRoom.whichRound,
          timeLimitSec: Math.round(pvpRoundTimeMs / 1000),
          totalRounds: pvpRoom.maxRounds
        };
        timeLeftSec = 0;
      }
    } else if (pvpRoom.state === "countdown") {
      showCountdownOverlay = true;
    }

    client.emit("battle:pvp_resync", {
      maxRounds: pvpRoom.maxRounds,
      opponentDisplayName,
      opponentScore,
      question,
      roomCode: pvpRoom.roomCode,
      roomState: pvpRoom.state,
      sessionId: pvpRoom.sessionId,
      settlingRound,
      showCountdownOverlay,
      timeLeftSec,
      userScore
    });
  }

  async joinLobby(client: Socket, input: { displayName?: string; userId: string }) {
    this.socketToLobbyUser.set(client.id, input.userId);
    this.lobbyUsers.set(input.userId, {
      displayName: input.displayName ?? null,
      joinedAt: new Date().toISOString(),
      socketId: client.id,
      userId: input.userId
    });
    await client.join("battle:lobby:global");
    this.emitLobbyPresence(client);
    client.emit("battle:lobby_joined", { roomKey: "global" });

    const pendingPvp = this.userToPvpRoom.get(input.userId);
    if (pendingPvp) {
      const reopened = this.pvpRooms.get(pendingPvp);
      if (reopened && reopened.state !== "finished") {
        this.clearPvpDisconnectTimer(reopened);
        this.clearPvpOpponentAbsentTimer(reopened);
        this.socketToPvpRoom.set(client.id, pendingPvp);
        await client.join(`battle:${pendingPvp}`);
        this.emitPvpResync(client, reopened, input.userId);
      } else {
        this.userToPvpRoom.delete(input.userId);
      }
    }
  }

  async sendLobbyMessage(
    client: Socket,
    input: {
      clientMessageId: string;
      displayName?: string;
      message: string;
      roomKey: string;
      userId: string;
    }
  ) {
    const knownUserId = this.socketToLobbyUser.get(client.id);
    if (knownUserId !== input.userId) {
      await this.joinLobby(client, { displayName: input.displayName, userId: input.userId });
    }
    const now = Date.now();
    const recent = (this.lobbyMessageWindows.get(input.userId) ?? []).filter(
      (timestamp) => now - timestamp < lobbyChatWindowMs
    );
    if (recent.length >= lobbyChatWindowLimit) {
      await this.battleRepository.createAnalyticsEvent({
        eventName: "battle_chat_rate_limited",
        payload: {
          limit: lobbyChatWindowLimit,
          roomKey: input.roomKey,
          windowMs: lobbyChatWindowMs
        },
        userId: input.userId
      });
      client.emit("battle:lobby_error", { code: "rate_limited" });
      return;
    }
    recent.push(now);
    this.lobbyMessageWindows.set(input.userId, recent);
    const message = await this.battleRepository.createChatMessage({
      displayName: input.displayName ?? null,
      message: input.message,
      metadata: { clientMessageId: input.clientMessageId },
      roomKey: input.roomKey,
      userId: input.userId
    });
    client.nsp.to("battle:lobby:global").emit("battle:lobby_message", message);

    // Trigger bot response after a short delay to feel natural
    void this.scheduleBotResponse(input);
  }

  private async scheduleBotResponse(
    input: { displayName?: string; message: string; roomKey: string; userId: string }
  ) {
    try {
      if (!this.nsp) {
        this.logger.warn("Bot chat response skipped: namespace not available");
        return;
      }
      const botKey = this.lobbyActiveBotKey;
      const botProfile = await this.battleRepository.getPlayableBot(botKey);
      if (!botProfile) return;

      // Collect recent messages for context (last 10)
      const recent = await this.battleRepository.listRecentChatMessages({
        limit: 10,
        roomKey: input.roomKey
      });

      const botDisplayName = botProfile.label;
      const response = await this.botResponder.generateResponse({
        botDifficulty: botProfile.difficulty,
        botDisplayName,
        botKey,
        botPersona: botProfile.persona,
        botVocabularyLevel: botProfile.vocabularyLevel,
        recentMessages: recent.map((m) => ({
          kind: (m.kind as string) ?? "chat",
          message: m.message as string,
          userId: m.userId as string
        })),
        userDisplayName: input.displayName ?? "Learner",
        userMessage: input.message
      });

      if (!response) return;

      // Delay 1–3 seconds to feel natural
      const delay = 1000 + Math.floor(Math.random() * 2000);
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });

      const botMessage = await this.battleRepository.createChatMessage({
        displayName: botDisplayName,
        kind: "bot",
        message: response,
        metadata: { botKey, source: "template" },
        roomKey: input.roomKey,
        userId: `bot:${botKey}`
      });
      this.nsp.to("battle:lobby:global").emit("battle:lobby_message", botMessage);
    } catch (error) {
      this.logger.warn(`Bot chat response failed: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  async challengeUser(
    client: Socket,
    input: { fromDisplayName?: string; fromUserId: string; targetUserId: string }
  ) {
    if (input.fromUserId === input.targetUserId) {
      client.emit("battle:lobby_error", { code: "cannot_challenge_self" });
      return;
    }
    if (this.socketToLobbyUser.get(client.id) !== input.fromUserId) {
      await this.joinLobby(client, { displayName: input.fromDisplayName, userId: input.fromUserId });
    }

    const target = this.lobbyUsers.get(input.targetUserId);
    const challengeId = randomBytes(8).toString("hex");
    const challenge: PendingChallenge = {
      challengeId,
      createdAt: Date.now(),
      fromDisplayName: input.fromDisplayName ?? null,
      fromUserId: input.fromUserId,
      targetUserId: input.targetUserId
    };
    this.pendingChallenges.set(challengeId, challenge);
    // Auto-expire challenge
    setTimeout(() => {
      if (this.pendingChallenges.has(challengeId)) {
        this.pendingChallenges.delete(challengeId);
        const fromSocket = this.lobbyUsers.get(input.fromUserId);
        if (fromSocket && this.nsp) {
          this.nsp.to(fromSocket.socketId).emit("battle:challenge_expired", { challengeId });
        }
      }
    }, challengeExpiryMs);
    const payload = {
      challengeId,
      createdAt: new Date().toISOString(),
      fromDisplayName: input.fromDisplayName ?? null,
      fromUserId: input.fromUserId,
      targetUserId: input.targetUserId
    };
    const deliveredViaBattle = Boolean(target);
    const deliveredViaPresence = deliveredViaBattle
      ? false
      : this.presenceGateway.emitToUser(input.targetUserId, "battle:user_challenge_received", payload);

    await this.battleRepository.createAnalyticsEvent({
      eventName: "battle_user_challenge_created",
      payload: {
        challengeId,
        delivered: deliveredViaBattle || deliveredViaPresence,
        deliveredViaBattle,
        deliveredViaPresence,
        targetUserId: input.targetUserId
      },
      userId: input.fromUserId
    });
    client.emit("battle:user_challenge_sent", payload);
    if (target) {
      client.nsp.to(target.socketId).emit("battle:user_challenge_received", payload);
    }
  }

  async acceptChallenge(
    client: Socket,
    input: { challengeId: string; fromUserId: string; userId: string }
  ) {
    const challenge = this.pendingChallenges.get(input.challengeId);
    if (!challenge) {
      client.emit("battle:lobby_error", { code: "challenge_expired" });
      return;
    }
    if (challenge.targetUserId !== input.userId || challenge.fromUserId !== input.fromUserId) {
      client.emit("battle:lobby_error", { code: "challenge_mismatch" });
      return;
    }
    if (this.socketToLobbyUser.get(client.id) !== input.userId) {
      await this.joinLobby(client, { userId: input.userId });
    }
    this.pendingChallenges.delete(input.challengeId);

    // Clean up any existing PvP rooms for both players
    const prevA = this.userToPvpRoom.get(input.userId);
    if (prevA) void this.abandonPvpRoom(prevA, "replaced");
    const prevB = this.userToPvpRoom.get(input.fromUserId);
    if (prevB) void this.abandonPvpRoom(prevB, "replaced");

    const fairnessSeed = randomBytes(16).toString("hex");
    let created: Awaited<ReturnType<BattleRepository["createPvpBattle"]>>;
    try {
      created = await this.battleRepository.createPvpBattle({
        fairnessSeed,
        opponentUserId: input.fromUserId,
        userId: input.userId
      });
    } catch (e) {
      if (e instanceof Error && e.message === "BATTLE_NO_QUESTIONS") {
        client.emit("battle:error", { code: "no_questions" });
        return;
      }
      throw e;
    }

    const acceptorDisplayName = this.lobbyUsers.get(input.userId)?.displayName ?? null;
    const challengerDisplayName = challenge.fromDisplayName ?? this.lobbyUsers.get(input.fromUserId)?.displayName ?? null;

    const pvpRoom: PvpRoomState = {
      gameType: "speed_duel",
      idempotency: new Set(),
      maxRounds: created.questions.length,
      opponentDisplayName: challengerDisplayName ?? "Opponent",
      opponentScore: 0,
      opponentUserId: input.fromUserId,
      questions: created.questions,
      roomCode: created.roomCode,
      roundIds: created.roundIds,
      roundAnswers: new Map(),
      roundStartMs: 0,
      roundTimer: null,
      abandonAfterDisconnectTimer: null,
      opponentAbsentWinTimer: null,
      opponentAbsentUserId: null,
      sessionId: created.session.id,
      state: "countdown",
      userDisplayName: acceptorDisplayName ?? "Player",
      userId: input.userId,
      userScore: 0,
      whichRound: 0
    };

    this.pvpRooms.set(created.roomCode, pvpRoom);
    this.userToPvpRoom.set(input.userId, created.roomCode);
    this.userToPvpRoom.set(input.fromUserId, created.roomCode);
    this.socketToPvpRoom.set(client.id, created.roomCode);

    const challengerSocket = this.lobbyUsers.get(input.fromUserId);
    if (challengerSocket && this.nsp) {
      this.socketToPvpRoom.set(challengerSocket.socketId, created.roomCode);
    }

    await this.battleRepository.createAnalyticsEvent({
      eventName: "battle_pvp_match_started",
      payload: { roomCode: created.roomCode, sessionId: created.session.id },
      userId: input.userId
    });

    const matchPayload = {
      maxRounds: pvpRoom.maxRounds,
      mode: "pvp" as const,
      opponentDisplayName: challengerDisplayName,
      roomCode: created.roomCode,
      sessionId: created.session.id,
      userDisplayName: acceptorDisplayName
    };

    // Join both sockets to room
    void client.join(`battle:${created.roomCode}`);
    client.emit("battle:pvp_match_found", {
      ...matchPayload,
      opponentDisplayName: challengerDisplayName
    });

    if (challengerSocket && this.nsp) {
      const challengerSock = this.nsp.sockets.get(challengerSocket.socketId);
      if (challengerSock) {
        void challengerSock.join(`battle:${created.roomCode}`);
        challengerSock.emit("battle:pvp_match_found", {
          ...matchPayload,
          opponentDisplayName: acceptorDisplayName
        });
      }
    }

    void this.runPvpCountdownThenRounds(created.roomCode);
  }

  async declineChallenge(
    client: Socket,
    input: { challengeId: string; fromUserId: string; userId: string }
  ) {
    const challenge = this.pendingChallenges.get(input.challengeId);
    if (!challenge) {
      return; // Already expired
    }
    if (challenge.targetUserId !== input.userId) {
      return;
    }
    this.pendingChallenges.delete(input.challengeId);
    await this.battleRepository.createAnalyticsEvent({
      eventName: "battle_user_challenge_declined",
      payload: { challengeId: input.challengeId },
      userId: input.userId
    });
    const challengerSocket = this.lobbyUsers.get(input.fromUserId);
    if (challengerSocket && this.nsp) {
      this.nsp.to(challengerSocket.socketId).emit("battle:challenge_declined", {
        challengeId: input.challengeId,
        fromUserId: input.fromUserId,
        targetUserId: input.userId
      });
    }
    client.emit("battle:challenge_declined", {
      challengeId: input.challengeId,
      fromUserId: input.fromUserId,
      targetUserId: input.userId
    });
  }

  async forfeitPvpRoom(client: Socket, input: { roomCode: string; userId: string }) {
    const known = this.socketToLobbyUser.get(client.id);
    if (known !== input.userId) return;
    const room = this.pvpRooms.get(input.roomCode);
    if (!room || room.state === "finished") return;
    if (input.userId !== room.userId && input.userId !== room.opponentUserId) return;
    await this.abandonPvpRoom(input.roomCode, "user_forfeit", { forfeitingUserId: input.userId });
  }

  async submitPvpAnswer(
    client: Socket,
    input: {
      idempotencyKey: string;
      optionKey: string;
      roomCode: string;
      roundIndex: number;
      userId: string;
    }
  ) {
    const pvpRoom = this.pvpRooms.get(input.roomCode);
    if (!pvpRoom) {
      client.emit("battle:error", { code: "room_not_found" });
      return;
    }
    if (pvpRoom.state !== "question") {
      return;
    }
    if (input.roundIndex !== pvpRoom.whichRound) {
      return;
    }
    // Must be one of the two players
    if (input.userId !== pvpRoom.userId && input.userId !== pvpRoom.opponentUserId) {
      client.emit("battle:error", { code: "user_mismatch" });
      return;
    }
    const idk = `${input.roundIndex}-${input.userId}-${input.idempotencyKey}`;
    if (pvpRoom.idempotency.has(idk)) {
      return;
    }
    pvpRoom.idempotency.add(idk);

    // Already answered this round
    if (pvpRoom.roundAnswers.has(input.userId)) {
      return;
    }

    const q = pvpRoom.questions[pvpRoom.whichRound]!;
    const isKnownOption = q.options.some((o) => o.optionKey === input.optionKey);
    if (!isKnownOption) {
      client.emit("battle:error", { code: "option_mismatch" });
      return;
    }

    const responseMs = Math.max(0, Math.min(pvpRoundTimeMs, Date.now() - pvpRoom.roundStartMs));
    pvpRoom.roundAnswers.set(input.userId, { optionKey: input.optionKey, responseMs });

    // Notify both players that this user has answered
    if (this.nsp) {
      this.nsp.to(`battle:${input.roomCode}`).emit("battle:pvp_opponent_answered", {
        roundIndex: pvpRoom.whichRound,
        userId: input.userId
      });
    }

    // If both players have answered, settle the round
    if (pvpRoom.roundAnswers.has(pvpRoom.userId) && pvpRoom.roundAnswers.has(pvpRoom.opponentUserId)) {
      await this.settlePvpRound(input.roomCode, false);
    }
  }

  private async settlePvpRound(roomCode: string, _timeout: boolean) {
    const pvpRoom = this.pvpRooms.get(roomCode);
    if (!pvpRoom || pvpRoom.state === "finished" || pvpRoom.state === "resolving") {
      return;
    }
    pvpRoom.state = "resolving";
    this.clearPvpRoundTimer(pvpRoom);

    const q = pvpRoom.questions[pvpRoom.whichRound]!;
    const correct = q.options.find((o) => o.isCorrect)?.optionKey;
    if (!correct) {
      pvpRoom.state = "question";
      return;
    }

    const userAnswer = pvpRoom.roundAnswers.get(pvpRoom.userId);
    const opponentAnswer = pvpRoom.roundAnswers.get(pvpRoom.opponentUserId);

    const userOptionKey = userAnswer?.optionKey ?? null;
    const userCorrect = userOptionKey === correct;
    const userResponseMs = userAnswer?.responseMs ?? pvpRoundTimeMs;

    const opponentOptionKey = opponentAnswer?.optionKey ?? null;
    const opponentCorrect = opponentOptionKey === correct;
    const opponentResponseMs = opponentAnswer?.responseMs ?? pvpRoundTimeMs;

    const userDelta = userCorrect ? 1 : 0;
    const opponentDelta = opponentCorrect ? 1 : 0;
    const nextUserScore = pvpRoom.userScore + userDelta;
    const nextOpponentScore = pvpRoom.opponentScore + opponentDelta;
    const roundId = pvpRoom.roundIds[pvpRoom.whichRound]!;

    try {
      await this.battleRepository.updatePvpRoundWithScores({
        decidedAt: new Date(),
        newCurrentRoundIndex: pvpRoom.whichRound + 1,
        nextOpponentScore,
        nextUserScore,
        opponentCorrect,
        opponentOptionKey,
        opponentResponseMs,
        roundId,
        sessionId: pvpRoom.sessionId,
        userId: pvpRoom.userId,
        userCorrect,
        userOptionKey,
        userResponseMs
      });
    } catch (error) {
      this.logger.warn(`PvP round update failed: ${(error as Error).message}`);
    }

    pvpRoom.userScore = nextUserScore;
    pvpRoom.opponentScore = nextOpponentScore;

    if (this.nsp) {
      // Send individual results: user gets their perspective, opponent gets theirs
      const userSocket = this.findSocketForUser(pvpRoom.userId);
      const opponentSocket = this.findSocketForUser(pvpRoom.opponentUserId);

      if (userSocket) {
        userSocket.emit("battle:answer_result", {
          correctOptionKey: correct,
          opponentCorrect,
          roundIndex: pvpRoom.whichRound,
          userCorrect
        });
        userSocket.emit("battle:score_update", {
          opponentScore: nextOpponentScore,
          userScore: nextUserScore
        });
      }

      if (opponentSocket) {
        // For the opponent, "user" and "opponent" are swapped
        opponentSocket.emit("battle:answer_result", {
          correctOptionKey: correct,
          opponentCorrect: userCorrect,
          roundIndex: pvpRoom.whichRound,
          userCorrect: opponentCorrect
        });
        opponentSocket.emit("battle:score_update", {
          opponentScore: nextUserScore,
          userScore: nextOpponentScore
        });
      }
    }

    const lastRound = pvpRoom.whichRound === pvpRoom.maxRounds - 1;
    pvpRoom.whichRound += 1;

    if (lastRound) {
      pvpRoom.state = "finished";
      try {
        await this.battleRepository.markPvpCompleted(pvpRoom.sessionId, {
          opponentScore: nextOpponentScore,
          userScore: nextUserScore
        });
      } catch { /* best effort */ }

      const userOutcome = nextUserScore > nextOpponentScore ? "win" : nextUserScore < nextOpponentScore ? "lose" : "draw";

      await this.battleRepository.createAnalyticsEvent({
        eventName: "battle_pvp_match_completed",
        payload: {
          opponentScore: nextOpponentScore,
          outcome: userOutcome,
          roomCode,
          sessionId: pvpRoom.sessionId,
          userScore: nextUserScore
        },
        userId: pvpRoom.userId
      });

      if (this.nsp) {
        const userSocket = this.findSocketForUser(pvpRoom.userId);
        const opponentSocket = this.findSocketForUser(pvpRoom.opponentUserId);

        if (userSocket) {
          userSocket.emit("battle:finished", {
            outcome: userOutcome,
            remediation: null,
            sessionId: pvpRoom.sessionId
          });
        }
        if (opponentSocket) {
          const oppOutcome = userOutcome === "win" ? "lose" : userOutcome === "lose" ? "win" : "draw";
          opponentSocket.emit("battle:finished", {
            outcome: oppOutcome,
            remediation: null,
            sessionId: pvpRoom.sessionId
          });
        }
      }

      this.cleanupPvpRoom(roomCode);
    } else {
      pvpRoom.roundAnswers.clear();
      pvpRoom.state = "countdown";
      await this.pvpCountdownBetweenRounds(roomCode);
      this.beginPvpRound(roomCode);
    }
  }

  private findSocketForUser(userId: string): Socket | null {
    if (!this.nsp) return null;
    const lobbyUser = this.lobbyUsers.get(userId);
    if (!lobbyUser) return null;
    return this.nsp.sockets.get(lobbyUser.socketId) ?? null;
  }

  private async runPvpCountdownThenRounds(roomCode: string) {
    const pvpRoom = this.pvpRooms.get(roomCode);
    if (!pvpRoom) return;

    for (const value of [3, 2, 1]) {
      if (!this.pvpRooms.get(roomCode)) return;
      if (this.nsp) {
        this.nsp.to(`battle:${roomCode}`).emit("battle:countdown", { value });
      }
      await new Promise((r) => { setTimeout(r, 700); });
    }
    this.beginPvpRound(roomCode);
  }

  private async pvpCountdownBetweenRounds(roomCode: string) {
    for (const value of [3, 2, 1]) {
      if (!this.pvpRooms.get(roomCode)) return;
      if (this.nsp) {
        this.nsp.to(`battle:${roomCode}`).emit("battle:countdown", { value });
      }
      await new Promise((r) => { setTimeout(r, 400); });
    }
  }

  private beginPvpRound(roomCode: string) {
    const pvpRoom = this.pvpRooms.get(roomCode);
    if (!pvpRoom || pvpRoom.state === "finished") return;
    if (pvpRoom.whichRound >= pvpRoom.maxRounds) return;

    pvpRoom.state = "question";
    pvpRoom.roundStartMs = Date.now();
    pvpRoom.roundAnswers.clear();
    const q = pvpRoom.questions[pvpRoom.whichRound]!;

    this.clearPvpRoundTimer(pvpRoom);
    const expectRound = pvpRoom.whichRound;
    pvpRoom.roundTimer = setTimeout(() => {
      const current = this.pvpRooms.get(roomCode);
      if (!current || current.whichRound !== expectRound || current.state !== "question") return;
      void this.settlePvpRound(roomCode, true);
    }, pvpRoundTimeMs);

    const questionPayload = {
      gameType: pvpRoom.gameType,
      interactionType: this.getInteractionType(pvpRoom.gameType),
      question: {
        audioScript: q.audioScript ?? null,
        audioUrl: q.audioUrl ?? null,
        options: q.options.map((o) => ({ optionKey: o.optionKey, text: o.text })),
        prompt: q.prompt,
        questionId: q.questionId,
        skillTag: q.skillTag
      },
      roomCode,
      roundIndex: pvpRoom.whichRound,
      timeLimitSec: 45,
      totalRounds: pvpRoom.maxRounds
    };

    if (this.nsp) {
      this.nsp.to(`battle:${roomCode}`).emit("battle:question", questionPayload);
    }
  }

  private clearPvpRoundTimer(pvpRoom: PvpRoomState) {
    if (pvpRoom.roundTimer) {
      clearTimeout(pvpRoom.roundTimer);
      pvpRoom.roundTimer = null;
    }
  }

  private async abandonPvpRoom(
    roomCode: string,
    reason: string,
    options?: { forfeitingUserId?: string }
  ) {
    const pvpRoom = this.pvpRooms.get(roomCode);
    if (!pvpRoom) return;
    this.clearPvpDisconnectTimer(pvpRoom);
    this.clearPvpRoundTimer(pvpRoom);
    this.clearPvpOpponentAbsentTimer(pvpRoom);

    const forfeitingUserId = options?.forfeitingUserId;
    const splitOutcome =
      Boolean(forfeitingUserId) && (reason === "user_forfeit" || reason === "opponent_disconnect");

    if (splitOutcome && forfeitingUserId && this.nsp) {
      const winnerId =
        forfeitingUserId === pvpRoom.userId ? pvpRoom.opponentUserId : pvpRoom.userId;
      const winnerSock = this.findSocketForUser(winnerId);
      const loserSock = this.findSocketForUser(forfeitingUserId);

      try {
        await this.battleRepository.markAbandoned(pvpRoom.sessionId, {
          reason,
          userId: forfeitingUserId
        });
        await this.battleRepository.createAnalyticsEvent({
          eventName: "battle_pvp_match_abandoned",
          payload: {
            forfeitingUserId,
            reason,
            roomCode,
            sessionId: pvpRoom.sessionId,
            winnerUserId: winnerId
          },
          userId: forfeitingUserId
        });
        await this.battleRepository.createAnalyticsEvent({
          eventName: "battle_pvp_forfeit_win",
          payload: { roomCode, sessionId: pvpRoom.sessionId, winnerUserId: winnerId },
          userId: winnerId
        });
      } catch {
        /* best effort */
      }

      winnerSock?.emit("battle:finished", {
        outcome: "win",
        remediation: null,
        sessionId: pvpRoom.sessionId,
        pvpEndReason: "opponent_quit"
      });
      loserSock?.emit("battle:finished", {
        outcome: "lose",
        remediation: null,
        sessionId: pvpRoom.sessionId,
        pvpEndReason: "self_quit"
      });
      this.cleanupPvpRoom(roomCode);
      return;
    }

    try {
      await this.battleRepository.markAbandoned(pvpRoom.sessionId, { reason, userId: pvpRoom.userId });
      await this.battleRepository.createAnalyticsEvent({
        eventName: "battle_pvp_match_abandoned",
        payload: { reason, roomCode, sessionId: pvpRoom.sessionId },
        userId: pvpRoom.userId
      });
    } catch {
      /* best effort */
    }

    if (this.nsp) {
      this.nsp.to(`battle:${roomCode}`).emit("battle:pvp_abandoned", { reason, roomCode });
    }
    this.cleanupPvpRoom(roomCode);
  }

  private cleanupPvpRoom(roomCode: string) {
    const pvpRoom = this.pvpRooms.get(roomCode);
    if (!pvpRoom) return;
    this.clearPvpDisconnectTimer(pvpRoom);
    this.clearPvpOpponentAbsentTimer(pvpRoom);
    this.pvpRooms.delete(roomCode);
    this.userToPvpRoom.delete(pvpRoom.userId);
    this.userToPvpRoom.delete(pvpRoom.opponentUserId);
    // Clean socket mappings
    for (const [socketId, code] of this.socketToPvpRoom) {
      if (code === roomCode) this.socketToPvpRoom.delete(socketId);
    }
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

  private emitBotState(client: Socket, room: RoomState, state: BattleBotAnimationState) {
    client.emit("battle:bot_state", {
      botKey: room.botKey,
      persona: room.botProfile.persona,
      rive: room.botProfile.rive,
      state,
      styleToken: room.botProfile.styleToken
    });
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

  async startBotBattle(client: Socket, input: { botKey: string; configId?: string; userId: string }) {
    const playableBot = await this.battleRepository.getPlayableBot(input.botKey);
    if (!playableBot) {
      throw new BadRequestException("invalid_bot_key");
    }

    // Load config params if configId provided
    let configMaxRounds: number | undefined;
    let configTimeSec: number | undefined;
    let configGameType: string = "speed_duel";
    if (input.configId) {
      const config = await this.battleRepository.getPublishedConfig(input.configId);
      if (config) {
        configMaxRounds = config.questionCount;
        configTimeSec = config.timePerQuestionSec;
        configGameType = config.gameType;
      }
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
        maxRounds: configMaxRounds,
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
      botProfile: playableBot,
      configTimeSec: configTimeSec ?? Math.round(roundTimeMs / 1000),
      gameType: configGameType,
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
      whichRound: 0,
      userCorrectStreak: 0,
      botCorrectStreak: 0,
      lastCommentRound: -2
    };
    this.rooms.set(roomCode, room);
    this.userActiveRoom.set(input.userId, roomCode);
    this.socketToRoom.set(client.id, roomCode);
    await this.battleRepository.createAnalyticsEvent({
      eventName: "battle_match_started",
      payload: { botKey: input.botKey, mode: "bot", roomCode, sessionId: room.sessionId },
      userId: input.userId
    });
    void client.join(`battle:${roomCode}`);
    client.emit("battle:match_found", {
      bot: {
        accuracyPct: playableBot.accuracyPct,
        avatarFallback: playableBot.avatarFallback,
        difficulty: playableBot.difficulty,
        key: input.botKey,
        label: playableBot.label,
        maxDelayMs: playableBot.maxDelayMs,
        minDelayMs: playableBot.minDelayMs,
        persona: playableBot.persona,
        rive: playableBot.rive,
        styleToken: playableBot.styleToken,
        vocabularyLevel: playableBot.vocabularyLevel
      },
      gameType: room.gameType,
      maxRounds: room.maxRounds,
      roomCode,
      sessionId: room.sessionId
    });
    this.emitBotState(client, room, "matched");
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
      this.emitBotState(client, room, "countdown");
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
    this.emitBotState(client, room, "thinking");
    const expectRound = room.whichRound;
    room.roundTimer = setTimeout(() => {
      const current = this.rooms.get(roomCode);
      if (!current || current.whichRound !== expectRound || current.state !== "question") {
        return;
      }
      void this.settleRound(client, roomCode, { timeout: true });
    }, room.configTimeSec * 1000);
    client.emit("battle:question", {
      gameType: room.gameType,
      interactionType: this.getInteractionType(room.gameType),
      roundIndex: room.whichRound,
      roomCode,
      timeLimitSec: room.configTimeSec,
      totalRounds: room.maxRounds,
      question: {
        audioScript: q.audioScript ?? null,
        audioUrl: q.audioUrl ?? null,
        options: this.safeOptionsForClient(q),
        prompt: q.prompt,
        questionId: q.questionId,
        skillTag: q.skillTag
      }
    });
  }

  private getInteractionType(gameType: string): string {
    switch (gameType) {
      case "kanji_vocab_duel": return "matching";
      case "listening_challenge": return "audio_only";
      case "boss_rush": return "boss_hp";
      case "mock_exam_sprint": return "passage";
      default: return "multiple_choice";
    }
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
        userResponseMs = room.configTimeSec * 1000;
        userOptionKey = null;
        userCorrect = false;
      } else {
        userResponseMs = Math.max(0, Math.min(room.configTimeSec * 1000, now - room.roundStartMs));
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
      const rng = Math.random;
      const optionKeys = q.options.map((o) => o.optionKey);
      const botDelay = randomBetween(rng, room.botProfile.minDelayMs, room.botProfile.maxDelayMs);
      await new Promise((r) => {
        setTimeout(r, botDelay);
      });
      const bot = decideBotOption({
        correctOptionKey: correct,
        correctProbability: room.botProfile.accuracyPct / 100,
        optionKeys,
        random: rng
      });
      const botCorrect = bot.optionKey === correct;
      this.emitBotState(client, room, botCorrect ? "correct" : "wrong");
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
        room.missedSkillTagCounts.set(
          q.skillTag,
          (room.missedSkillTagCounts.get(q.skillTag) ?? 0) + 1
        );
      }
      room.userScore = nextUser;
      room.opponentScore = nextOp;
      // Update streaks for commentary
      room.userCorrectStreak = userCorrect ? room.userCorrectStreak + 1 : 0;
      room.botCorrectStreak = botCorrect ? room.botCorrectStreak + 1 : 0;
      client.emit("battle:answer_result", {
        botCorrect,
        correctOptionKey: correct,
        roundIndex: room.whichRound,
        userCorrect
      });
      client.emit("battle:score_update", { opponentScore: nextOp, userScore: nextUser });
      // Bot commentary
      const baseTrigger: CommentaryTrigger =
        userCorrect && botCorrect ? "both_correct"
          : !userCorrect && !botCorrect ? "both_wrong"
            : userCorrect ? "user_correct"
              : "bot_correct";
      const commentCtx: CommentaryContext = {
        botKey: room.botKey,
        botCorrectStreak: room.botCorrectStreak,
        botScore: nextOp,
        currentRound: room.whichRound,
        totalRounds: room.maxRounds,
        trigger: baseTrigger,
        userCorrectStreak: room.userCorrectStreak,
        userScore: nextUser
      };
      const commentary = generateBattleCommentary(commentCtx, room.lastCommentRound);
      if (commentary) {
        room.lastCommentRound = room.whichRound;
        client.emit("battle:bot_comment", { message: commentary.message, trigger: commentary.trigger });
      }
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
        this.emitBotState(
          client,
          room,
          outcome === "win" ? "lose" : outcome === "lose" ? "win" : "draw"
        );
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
          this.emitBotState(client, room, "countdown");
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
