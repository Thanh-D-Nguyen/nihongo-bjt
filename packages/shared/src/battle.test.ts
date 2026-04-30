import { describe, expect, it, vi } from "vitest";

import { decideBotOption } from "./battle.js";

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
});
