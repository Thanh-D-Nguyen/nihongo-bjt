import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { BattleOrchestratorService } from "./battle-orchestrator.service.js";

vi.mock("@nihongo-bjt/shared", async () => {
  const actual = await vi.importActual<typeof import("@nihongo-bjt/shared")>("@nihongo-bjt/shared");
  return {
    ...actual,
    decideBotOption: vi.fn().mockImplementation(({ correctOptionKey }) => ({ optionKey: correctOptionKey })),
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
      markAbandoned: vi.fn().mockResolvedValue(undefined),
      markCompleted: vi.fn().mockResolvedValue(undefined),
      updateRoundWithScores: vi.fn().mockResolvedValue(undefined)
    };
    const matchmaking = { releaseUser: vi.fn() };
    const service = new BattleOrchestratorService(repository as any, matchmaking as any);
    return { matchmaking, repository, service };
  }

  it("rejects answer option not present in question options", async () => {
    const { service } = buildService();
    const client = { emit: vi.fn(), id: "socket-1" };
    (service as any).rooms.set("room-1", {
      botKey: "bot_j3",
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

    await expect(
      service.startBotBattle(client as any, { botKey: "bot_cheat", userId: "00000000-0000-4000-8000-000000000001" })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(matchmaking.releaseUser).not.toHaveBeenCalled();
    expect(repository.createBotBattle).not.toHaveBeenCalled();
  });

  it("emits remediation payload and suspicious-speed analytics on fast losing answer", async () => {
    const { repository, service } = buildService();
    const client = { emit: vi.fn(), id: "socket-2" };
    (service as any).rooms.set("room-2", {
      botKey: "bot_j3",
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
