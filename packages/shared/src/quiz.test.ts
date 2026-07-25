import { describe, expect, it } from "vitest";

import { scoreBjtMockExam, scoreBjtPractice } from "./quiz.js";

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

describe("scoreBjtMockExam", () => {
  it("balances sections and weights harder correct items on the 0-800 estimated scale", () => {
    const result = scoreBjtMockExam({
      items: [
        {
          difficulty: "easy",
          isCorrect: true,
          sectionCode: "listening",
          skillTag: "gist"
        },
        {
          difficulty: "hard",
          isCorrect: true,
          sectionCode: "listening",
          skillTag: "detail"
        },
        {
          difficulty: "standard",
          isCorrect: false,
          sectionCode: "reading",
          skillTag: "gist"
        },
        {
          answered: false,
          difficulty: "standard",
          isCorrect: false,
          sectionCode: "reading",
          skillTag: "detail"
        }
      ]
    });

    expect(result.algorithmVersion).toBe("bjt-estimate-v2");
    expect(result.answeredCount).toBe(3);
    expect(result.accuracy).toBe(0.5);
    expect(result.estimatedScore).toBe(400);
    expect(result.estimatedBjtBand).toBe("J3");
    expect(result.sectionPerformance).toEqual([
      {
        accuracy: 1,
        answeredCount: 2,
        correctCount: 2,
        key: "listening",
        totalQuestions: 2,
        weightedAccuracy: 1
      },
      {
        accuracy: 0,
        answeredCount: 1,
        correctCount: 0,
        key: "reading",
        totalQuestions: 2,
        weightedAccuracy: 0
      }
    ]);
  });

  it("never gives credit for an unanswered item and clamps empty input to zero", () => {
    expect(
      scoreBjtMockExam({
        items: [{ answered: false, difficulty: "hard", isCorrect: true, sectionCode: "reading" }]
      })
    ).toMatchObject({
      accuracy: 0,
      answeredCount: 0,
      estimatedBjtBand: "J5",
      estimatedScore: 0
    });
    expect(scoreBjtMockExam({ items: [] })).toEqual({
      accuracy: 0,
      algorithmVersion: "bjt-estimate-v2",
      answeredCount: 0,
      estimatedBjtBand: "J5",
      estimatedScore: 0,
      sectionPerformance: [],
      skillPerformance: []
    });
  });
});
