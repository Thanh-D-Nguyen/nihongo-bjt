import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { BattleGateway } from "./battle.gateway.js";

describe("BattleGateway", () => {
  it("maps invalid bot key error to invalid_bot socket code", async () => {
    const orchestrator = {
      onDisconnect: vi.fn(),
      startBotBattle: vi.fn().mockRejectedValue(new BadRequestException("invalid_bot_key")),
      submitAnswer: vi.fn()
    };
    const gateway = new BattleGateway(orchestrator as any);
    const client = { emit: vi.fn(), id: "socket-test" };

    await gateway.onChallengeBot(client as any, {
      botKey: "bot_j3",
      userId: "00000000-0000-4000-8000-000000000001"
    });

    expect(client.emit).toHaveBeenCalledWith("battle:error", { code: "invalid_bot" });
  });

  it("maps other bad request to no_questions socket code", async () => {
    const orchestrator = {
      onDisconnect: vi.fn(),
      startBotBattle: vi.fn().mockRejectedValue(new BadRequestException("No published questions available for battle")),
      submitAnswer: vi.fn()
    };
    const gateway = new BattleGateway(orchestrator as any);
    const client = { emit: vi.fn(), id: "socket-test" };

    await gateway.onChallengeBot(client as any, {
      botKey: "bot_j3",
      userId: "00000000-0000-4000-8000-000000000001"
    });

    expect(client.emit).toHaveBeenCalledWith("battle:error", { code: "no_questions" });
  });
});
