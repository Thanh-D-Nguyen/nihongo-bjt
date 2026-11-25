import { describe, expect, it } from "vitest";
import { resolveBattleAnswerDisplayLabel } from "./battle-match-client";

describe("resolveBattleAnswerDisplayLabel", () => {
  const shuffled = [
    { optionKey: "C" },
    { optionKey: "A" },
    { optionKey: "D" },
    { optionKey: "B" }
  ];

  it("maps canonical correctOptionKey to positional A/B/C/D for speed duel and roleplay", () => {
    expect(resolveBattleAnswerDisplayLabel(shuffled, "B", "speed_duel")).toBe("D");
    expect(resolveBattleAnswerDisplayLabel(shuffled, "C", "business_roleplay")).toBe("A");
  });

  it("maps canonical correctOptionKey to 1-based positional number for mock_exam", () => {
    expect(resolveBattleAnswerDisplayLabel(shuffled, "B", "mock_exam")).toBe("4");
    expect(resolveBattleAnswerDisplayLabel(shuffled, "A", "mock_exam")).toBe("2");
  });

  it("falls back to raw optionKey when options are absent", () => {
    expect(resolveBattleAnswerDisplayLabel([], "B", "speed_duel")).toBe("B");
  });
});
