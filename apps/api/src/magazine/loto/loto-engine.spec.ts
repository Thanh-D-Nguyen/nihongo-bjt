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

  it("parses Loto6 CSV with Japanese headers (official format)", () => {
    const csv = [
      "開催回,日付,第1数字,第2数字,第3数字,第4数字,第5数字,第6数字,BONUS数字,1等口数,2等口数,3等口数,4等口数,5等口数,1等賞金,2等賞金,3等賞金,4等賞金,5等賞金,キャリーオーバー",
      "1,2000/10/5,2,8,10,13,27,30,39,2,2,262,12413,174452,45513600,40961900,375200,6900,1000,0",
      "2,2000/10/12,1,9,16,20,21,43,5,0,7,195,8426,144860,0,13188800,568100,11500,1000,102580607",
    ].join("\n");
    const rows = parseLotoCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        game: "loto6",
        drawNumber: 1,
        drawDate: "2000-10-05",
        mainNumbers: [2, 8, 10, 13, 27, 30],
        bonusNumbers: [39],
        carryoverAmount: 0n,
      }),
    );
    expect(rows[1]).toEqual(
      expect.objectContaining({
        game: "loto6",
        drawNumber: 2,
        drawDate: "2000-10-12",
        mainNumbers: [1, 9, 16, 20, 21, 43],
        bonusNumbers: [5],
        carryoverAmount: 102580607n,
      }),
    );
  });

  it("parses Loto7 CSV with Japanese headers (official format)", () => {
    const csv = [
      "開催回,日付,第1数字,第2数字,第3数字,第4数字,第5数字,第6数字,第7数字,BONUS数字1,BONUS数字2,1等口数,2等口数,3等口数,4等口数,5等口数,6等口数,1等賞金,2等賞金,3等賞金,4等賞金,5等賞金,6等賞金,キャリーオーバー",
      "1,2013/4/5,7,10,15,20,22,27,33,2,24,0,3,40,275,3080,38498,0,7297800,730100,9100,1400,1000,0",
    ].join("\n");
    const rows = parseLotoCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        game: "loto7",
        drawNumber: 1,
        drawDate: "2013-04-05",
        mainNumbers: [7, 10, 15, 20, 22, 27, 33],
        bonusNumbers: [2, 24],
        carryoverAmount: 0n,
      }),
    );
  });

  it("auto-detects game from Japanese headers", () => {
    const loto6Csv = "開催回,日付,第1数字,第2数字,第3数字,第4数字,第5数字,第6数字,BONUS数字,キャリーオーバー\n1,2024/1/1,1,5,10,20,30,40,7,0";
    const loto7Csv = "開催回,日付,第1数字,第2数字,第3数字,第4数字,第5数字,第6数字,第7数字,BONUS数字1,BONUS数字2,キャリーオーバー\n1,2024/1/1,1,5,10,15,20,25,30,2,7,0";

    const r6 = parseLotoCsv(loto6Csv);
    expect(r6[0]?.game).toBe("loto6");

    const r7 = parseLotoCsv(loto7Csv);
    expect(r7[0]?.game).toBe("loto7");
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
