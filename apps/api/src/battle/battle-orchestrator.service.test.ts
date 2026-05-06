import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { BattleOrchestratorService } from "./battle-orchestrator.service.js";

vi.mock("@nihongo-bjt/shared", async () => {
  const actual = await vi.importActual<typeof import("@nihongo-bjt/shared")>("@nihongo-bjt/shared");
  return {
    ...actual,
    decideBotOption: vi
      .fn()
      .mockImplementation(({ correctOptionKey }) => ({ optionKey: correctOptionKey })),
    getBattleBotProfile: vi.fn().mockReturnValue({
      correctProbability: 1,
      labelI18nKey: "battle.bots.j3",
      maxDelayMs: 0,
      minDelayMs: 0
    }),
    randomBetween: vi.fn().mockReturnValue(0)
  };
});

describe("BattleOrchestratorService", () => {
  const botProfile = {
    accuracyPct: 100,
    avatarFallback: "J3",
    botKey: "bot_j3",
    difficulty: "medium",
    label: "battle.bots.j3",
    maxDelayMs: 0,
    minDelayMs: 0,
    persona: "battle.botPersonas.j3",
    rive: { artboard: "BotJ3", src: null, stateMachine: "BattleBot" },
    styleToken: "focused",
    vocabularyLevel: "bjt_intermediate"
  } as const;

  function buildService() {
    const repository = {
      abandonInProgressForUser: vi.fn().mockResolvedValue(undefined),
      createBotBattle: vi.fn().mockResolvedValue({
        questions: [
          {
            options: [
              { isCorrect: true, optionKey: "A", text: "A" },
              { isCorrect: false, optionKey: "B", text: "B" }
            ],
            prompt: "q",
            questionId: "q1",
            skillTag: "reading"
          }
        ],
        roomCode: "room-start",
        roundIds: ["r-start"],
        session: { id: "s-start" }
      }),
      createAnalyticsEvent: vi.fn().mockResolvedValue(undefined),
      createChatMessage: vi.fn().mockImplementation((input: any) =>
        Promise.resolve({
          createdAt: new Date("2026-05-02T00:00:00.000Z"),
          displayName: input.displayName ?? null,
          id: input.metadata?.clientMessageId ?? "message-id",
          kind: "chat",
          message: input.message,
          metadata: input.metadata ?? {},
          roomKey: input.roomKey,
          userId: input.userId
        })
      ),
      getPlayableBot: vi.fn().mockResolvedValue(botProfile),
      listRecentChatMessages: vi.fn().mockResolvedValue([]),
      markAbandoned: vi.fn().mockResolvedValue(undefined),
      markCompleted: vi.fn().mockResolvedValue(undefined),
      updateRoundWithScores: vi.fn().mockResolvedValue(undefined)
    };
    const matchmaking = { releaseUser: vi.fn() };
    const botResponder = {
      generateResponse: vi.fn().mockResolvedValue(null)
    };
    const service = new BattleOrchestratorService(repository as any, matchmaking as any, botResponder as any);
    return { botResponder, matchmaking, repository, service };
  }

  it("rate limits global lobby chat at five messages per ten seconds", async () => {
    const { repository, service } = buildService();
    const to = vi.fn().mockReturnValue({ emit: vi.fn() });
    const client = {
      emit: vi.fn(),
      id: "socket-chat",
      join: vi.fn().mockResolvedValue(undefined),
      nsp: { to }
    };

    await service.joinLobby(client as any, { displayName: "Learner", userId: "u-chat" });
    for (let i = 0; i < 6; i += 1) {
      await service.sendLobbyMessage(client as any, {
        clientMessageId: `m-${i}`,
        displayName: "Learner",
        message: `hello ${i}`,
        roomKey: "global",
        userId: "u-chat"
      });
    }

    expect(repository.createChatMessage).toHaveBeenCalledTimes(5);
    expect(client.emit).toHaveBeenCalledWith("battle:lobby_error", { code: "rate_limited" });
    expect(repository.createAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "battle_chat_rate_limited", userId: "u-chat" })
    );
  });

  it("rejects answer option not present in question options", async () => {
    const { service } = buildService();
    const client = { emit: vi.fn(), id: "socket-1" };
    (service as any).rooms.set("room-1", {
      botKey: "bot_j3",
      botProfile,
      idempotency: new Set<string>(),
      maxRounds: 1,
      opponentScore: 0,
      questions: [
        {
          options: [
            { isCorrect: true, optionKey: "A", text: "A" },
            { isCorrect: false, optionKey: "B", text: "B" }
          ],
          prompt: "q",
          questionId: "q1",
          skillTag: "reading"
        }
      ],
      roomCode: "room-1",
      roundIds: ["r1"],
      roundStartMs: Date.now(),
      roundTimer: null,
      sessionId: "s1",
      state: "question",
      userId: "u1",
      userScore: 0,
      whichRound: 0
    });

    await expect(
      (service as any).settleRound(client, "room-1", {
        idempotencyKey: "idk",
        optionKey: "Z",
        roundIndex: 0,
        timeout: false,
        userId: "u1"
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect((service as any).rooms.get("room-1")?.state).toBe("question");
  });

  it("abandons room after repeated invalid answer attempts", async () => {
    const { repository, service } = buildService();
    const client = { emit: vi.fn(), id: "socket-3" };
    (service as any).rooms.set("room-3", {
      botKey: "bot_j3",
      botProfile,
      idempotency: new Set<string>(),
      maxRounds: 1,
      missedSkillTagCounts: new Map<string, number>(),
      invalidAnswerStrikes: 0,
      opponentScore: 0,
      questions: [
        {
          options: [
            { isCorrect: true, optionKey: "A", text: "A" },
            { isCorrect: false, optionKey: "B", text: "B" }
          ],
          prompt: "q",
          questionId: "q1",
          skillTag: "reading"
        }
      ],
      roomCode: "room-3",
      roundIds: ["r3"],
      roundStartMs: Date.now(),
      roundTimer: null,
      sessionId: "s3",
      state: "question",
      userId: "u3",
      userScore: 0,
      whichRound: 0
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(
        (service as any).settleRound(client, "room-3", {
          idempotencyKey: `idk-${attempt}`,
          optionKey: "Z",
          roundIndex: 0,
          timeout: false,
          userId: "u3"
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    }

    expect(repository.markAbandoned).toHaveBeenCalledWith("s3", {
      reason: "anti_abuse_threshold",
      userId: "u3"
    });
    expect(client.emit).toHaveBeenCalledWith("battle:error", { code: "abuse_detected" });
    expect((service as any).rooms.has("room-3")).toBe(false);
  });

  it("rejects unknown bot key before starting session", async () => {
    const { matchmaking, repository, service } = buildService();
    const client = { emit: vi.fn(), id: "socket-4", join: vi.fn() };
    repository.getPlayableBot.mockResolvedValueOnce(null);

    await expect(
      service.startBotBattle(client as any, {
        botKey: "bot_cheat",
        userId: "00000000-0000-4000-8000-000000000001"
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(matchmaking.releaseUser).not.toHaveBeenCalled();
    expect(repository.createBotBattle).not.toHaveBeenCalled();
  });

  it("emits remediation payload and suspicious-speed analytics on fast losing answer", async () => {
    const { repository, service } = buildService();
    const client = { emit: vi.fn(), id: "socket-2" };
    (service as any).rooms.set("room-2", {
      botKey: "bot_j3",
      botProfile,
      idempotency: new Set<string>(),
      maxRounds: 1,
      missedSkillTagCounts: new Map<string, number>(),
      invalidAnswerStrikes: 0,
      opponentScore: 0,
      questions: [
        {
          options: [
            { isCorrect: true, optionKey: "A", text: "A" },
            { isCorrect: false, optionKey: "B", text: "B" }
          ],
          prompt: "q",
          questionId: "q1",
          skillTag: "reading"
        }
      ],
      roomCode: "room-2",
      roundIds: ["r2"],
      roundStartMs: Date.now(),
      roundTimer: null,
      sessionId: "s2",
      state: "question",
      userId: "u2",
      userScore: 0,
      whichRound: 0
    });

    await (service as any).settleRound(client, "room-2", {
      idempotencyKey: "idk",
      optionKey: "B",
      roundIndex: 0,
      timeout: false,
      userId: "u2"
    });

    expect(repository.createAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "battle_answer_suspicious_speed", userId: "u2" })
    );
    expect(client.emit).toHaveBeenCalledWith(
      "battle:finished",
      expect.objectContaining({
        outcome: "lose",
        remediation: expect.objectContaining({
          ctaPath: "flashcards",
          kind: "review_queue",
          summaryI18nKey: "battle.remediation.loss_focus"
        })
      })
    );
  });
});
