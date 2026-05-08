import { describe, expect, it } from "vitest";

import { scoreBjtPractice } from "./quiz.js";

describe("scoreBjtPractice", () => {
  it("returns a clearly estimated BJT band from accuracy", () => {
    expect(scoreBjtPractice({ correctCount: 3, totalQuestions: 4 })).toEqual({
      accuracy: 0.75,
      estimatedBjtBand: "J1+",
      estimatedScore: 600
    });
  });

  it("handles empty sessions without throwing", () => {
    expect(scoreBjtPractice({ correctCount: 0, totalQuestions: 0 })).toEqual({
      accuracy: 0,
      estimatedBjtBand: "J5",
      estimatedScore: 0
    });
  });
});
