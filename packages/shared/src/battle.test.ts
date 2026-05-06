import { describe, expect, it, vi } from "vitest";

import { battleBotStateToRiveInput, decideBotOption, getBattleBotProfile } from "./battle.js";

describe("decideBotOption", () => {
  it("picks the correct key when random is always below probability", () => {
    const rng = vi.fn().mockReturnValue(0.01);
    const result = decideBotOption({
      correctOptionKey: "A",
      correctProbability: 0.5,
      optionKeys: ["A", "B", "C", "D"],
      random: rng
    });
    expect(result.optionKey).toBe("A");
  });

  it("picks a wrong key when random is high", () => {
    const rng = vi
      .fn()
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0) // for wrong[0] if one wrong
      .mockReturnValue(0);
    const result = decideBotOption({
      correctOptionKey: "A",
      correctProbability: 0.3,
      optionKeys: ["A", "B", "C", "D"],
      random: rng
    });
    expect(result.optionKey).not.toBe("A");
  });

  it("exposes bot animation metadata for the realtime battle client", () => {
    const profile = getBattleBotProfile("bot_j3");

    expect(profile.personaI18nKey).toBe("battle.botPersonas.j3");
    expect(profile.rive.stateMachine).toBeNull();
    expect(profile.rive.artboard).toBeNull();
    expect(profile.rive.src).toBe(
      "/assets/battle/bots/24876-46460-interactive-bunny-character.riv"
    );
    expect(battleBotStateToRiveInput("thinking")).toBe("battle_thinking");
  });

  it("maps each default bot to a Rive asset", () => {
    expect(getBattleBotProfile("bot_j1").rive.src).toBe(
      "/assets/battle/bots/23764-44433-character-customization-ui.riv"
    );
    expect(getBattleBotProfile("bot_j2").rive.src).toBe(
      "/assets/battle/bots/18912-35694-lil-guy.riv"
    );
    expect(getBattleBotProfile("bot_j4").rive.src).toBe(
      "/assets/battle/bots/20538-38646-cheeky-chops.riv"
    );
  });
});
