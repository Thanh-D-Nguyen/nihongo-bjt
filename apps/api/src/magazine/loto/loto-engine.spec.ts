import { describe, expect, it } from "vitest";

import { parseLotoCsv } from "./loto-csv.js";
import { generateLotoSets } from "./loto-engine.js";
import type { LotoDrawInput } from "./loto-types.js";

function draw(drawNumber: number): LotoDrawInput {
  const base = (drawNumber % 30) + 1;
  return {
    game: "loto6",
    drawNumber,
    drawDate: `2026-05-${String((drawNumber % 20) + 1).padStart(2, "0")}`,
    mainNumbers: [base, base + 1, base + 2, base + 3, base + 4, base + 5].map((n) => ((n - 1) % 43) + 1),
    bonusNumbers: [((base + 6 - 1) % 43) + 1],
  };
}

describe("loto lab engine", () => {
  it("parses Loto6 CSV rows", () => {
    const rows = parseLotoCsv(
      "game,drawNumber,drawDate,n1,n2,n3,n4,n5,n6,bonus\nloto6,1,2026-05-01,1,2,3,4,5,6,7",
    );
    expect(rows).toEqual([
      expect.objectContaining({
        game: "loto6",
        drawNumber: 1,
        mainNumbers: [1, 2, 3, 4, 5, 6],
        bonusNumbers: [7],
      }),
    ]);
  });

  it("generates deterministic 1-5 candidate sets", () => {
    const sets = generateLotoSets(
      {
        game: "loto6",
        targetDrawDate: "2026-05-26",
        setCount: 5,
        seed: "rain-dream",
        dreamText: "富士山と雨",
      },
      Array.from({ length: 30 }, (_, index) => draw(index + 1)),
    );

    expect(sets).toHaveLength(5);
    expect(sets[0]?.mainNumbers).toHaveLength(6);
    expect(new Set(sets[0]?.mainNumbers).size).toBe(6);
  });
});
