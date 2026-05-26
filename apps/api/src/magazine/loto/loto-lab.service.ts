import { BadRequestException, Injectable } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";

import { parseLotoCsv } from "./loto-csv.js";
import { generateLotoSets, summarizeLotoDraws } from "./loto-engine.js";
import { LOTO_GAME_SPECS, type LotoDrawInput, type LotoGame, type LotoGenerationInput } from "./loto-types.js";

function toDateOnly(value: string | Date): Date {
  const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : value;
  if (Number.isNaN(date.getTime())) throw new BadRequestException("Invalid date");
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function sanitizeBigInt(value: bigint | number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  return value.toString();
}

function validateGame(game: string): LotoGame {
  if (game === "loto6" || game === "loto7") return game;
  throw new BadRequestException("game must be loto6 or loto7");
}

function normalizeDraw(row: {
  game: string;
  drawNumber: number;
  drawDate: Date;
  mainNumbers: number[];
  bonusNumbers: number[];
  carryoverAmount?: bigint | null;
  salesAmount?: bigint | null;
  sourceUrl?: string | null;
  sourceProvider: string;
}) {
  return {
    game: row.game,
    drawNumber: row.drawNumber,
    drawDate: toDateKey(row.drawDate),
    mainNumbers: row.mainNumbers,
    bonusNumbers: row.bonusNumbers,
    carryoverAmount: sanitizeBigInt(row.carryoverAmount),
    salesAmount: sanitizeBigInt(row.salesAmount),
    sourceUrl: row.sourceUrl,
    sourceProvider: row.sourceProvider,
  };
}

function japaneseSentence(input: LotoGenerationInput) {
  const context = [input.weatherText, input.dreamText, input.luckyText].filter(Boolean).join("、");
  const jp = context
    ? `今日は「${context.slice(0, 40)}」というヒントから、落ち着いて数字を選びます。`
    : "今日は過去のデータを見ながら、落ち着いて数字を選びます。";
  return {
    textJp: jp,
    reading: "きょうはヒントから、おちついてすうじをえらびます。",
    textVi: context
      ? "Hôm nay dựa trên các gợi ý đã nhập, ta bình tĩnh chọn các con số."
      : "Hôm nay nhìn vào dữ liệu quá khứ và bình tĩnh chọn các con số.",
    vocabItems: [
      { wordJp: "過去", reading: "かこ", meaningVi: "quá khứ" },
      { wordJp: "数字", reading: "すうじ", meaningVi: "con số" },
      { wordJp: "落ち着く", reading: "おちつく", meaningVi: "bình tĩnh" },
    ],
  };
}

@Injectable()
export class LotoLabService {
  private readonly prisma: PrismaClient = createPrismaClient();

  async importCsv(csvText: string, fallbackGame?: string) {
    const draws = parseLotoCsv(csvText, fallbackGame ? validateGame(fallbackGame) : undefined);
    let created = 0;
    let updated = 0;

    for (const draw of draws) {
      const existing = await this.prisma.lotoDraw.findUnique({
        where: { game_drawNumber: { game: draw.game, drawNumber: draw.drawNumber } },
      });
      await this.upsertDraw(draw);
      if (existing) updated += 1;
      else created += 1;
    }

    return { created, updated, total: draws.length };
  }

  async upsertDraw(draw: LotoDrawInput) {
    const spec = LOTO_GAME_SPECS[draw.game];
    if (draw.mainNumbers.length !== spec.mainCount || draw.bonusNumbers.length !== spec.bonusCount) {
      throw new BadRequestException(`${draw.game} requires ${spec.mainCount} numbers and ${spec.bonusCount} bonus numbers`);
    }
    const saved = await this.prisma.lotoDraw.upsert({
      where: { game_drawNumber: { game: draw.game, drawNumber: draw.drawNumber } },
      create: {
        game: draw.game,
        drawNumber: draw.drawNumber,
        drawDate: toDateOnly(draw.drawDate),
        mainNumbers: draw.mainNumbers,
        bonusNumbers: draw.bonusNumbers,
        carryoverAmount: draw.carryoverAmount,
        salesAmount: draw.salesAmount,
        sourceUrl: draw.sourceUrl,
        sourceProvider: draw.sourceProvider ?? "csv_import",
      },
      update: {
        drawDate: toDateOnly(draw.drawDate),
        mainNumbers: draw.mainNumbers,
        bonusNumbers: draw.bonusNumbers,
        carryoverAmount: draw.carryoverAmount,
        salesAmount: draw.salesAmount,
        sourceUrl: draw.sourceUrl,
        sourceProvider: draw.sourceProvider ?? "csv_import",
        importedAt: new Date(),
      },
    });
    return normalizeDraw(saved);
  }

  async listDraws(game: LotoGame, limit = 20) {
    const rows = await this.prisma.lotoDraw.findMany({
      where: { game },
      orderBy: [{ drawDate: "desc" }, { drawNumber: "desc" }],
      take: Math.min(Math.max(limit, 1), 100),
    });
    return rows.map(normalizeDraw);
  }

  async summary(game: LotoGame) {
    const rows = await this.prisma.lotoDraw.findMany({
      where: { game },
      orderBy: [{ drawDate: "desc" }, { drawNumber: "desc" }],
      take: 500,
    });
    const draws = rows.map((row) => ({
      game,
      drawNumber: row.drawNumber,
      drawDate: toDateKey(row.drawDate),
      mainNumbers: row.mainNumbers,
      bonusNumbers: row.bonusNumbers,
    }));
    const stats = summarizeLotoDraws(game, draws);
    return {
      game,
      drawCount: rows.length,
      lastDraw: rows[0] ? normalizeDraw(rows[0]) : null,
      ...stats,
    };
  }

  async generate(input: LotoGenerationInput, actorId?: string) {
    const game = validateGame(input.game);
    const setCount = Math.min(Math.max(Number(input.setCount) || 3, 1), 5);
    const targetDrawDate = toDateOnly(input.targetDrawDate);
    const rows = await this.prisma.lotoDraw.findMany({
      where: { game },
      orderBy: [{ drawDate: "desc" }, { drawNumber: "desc" }],
      take: 500,
    });
    if (rows.length < 10) {
      throw new BadRequestException("Need at least 10 historical draws before generating Loto sets");
    }

    const drawInputs = rows.map((row) => ({
      game,
      drawNumber: row.drawNumber,
      drawDate: toDateKey(row.drawDate),
      mainNumbers: row.mainNumbers,
      bonusNumbers: row.bonusNumbers,
    }));
    const generationInput = { ...input, game, setCount, targetDrawDate: toDateKey(targetDrawDate) };
    const sets = generateLotoSets(generationInput, drawInputs);
    const sentence = japaneseSentence(generationInput);

    const run = await this.prisma.lotoGenerationRun.create({
      data: {
        game,
        targetDrawDate,
        seed: input.seed,
        requestedSetCount: setCount,
        inputConfigJson: {
          pinnedNumbers: input.pinnedNumbers ?? [],
          excludedNumbers: input.excludedNumbers ?? [],
        } as Prisma.InputJsonValue,
        algorithmWeightsJson: (input.weights ?? {}) as Prisma.InputJsonValue,
        contextJson: {
          weatherText: input.weatherText,
          dreamText: input.dreamText,
          luckyText: input.luckyText,
        } as Prisma.InputJsonValue,
        japaneseSentenceJson: sentence as Prisma.InputJsonValue,
        createdByAdminId: actorId,
        sets: {
          createMany: {
            data: sets.map((set, index) => ({
              rank: index + 1,
              mainNumbers: set.mainNumbers,
              bonusNumbers: set.bonusNumbers,
              score: set.score,
              explanationJson: set.explanation as Prisma.InputJsonValue,
              selectedForMagazine: index === 0,
            })),
          },
        },
      },
      include: { sets: { orderBy: { rank: "asc" } } },
    });

    return this.normalizeRun(run);
  }

  async latestRun(game: LotoGame) {
    const run = await this.prisma.lotoGenerationRun.findFirst({
      where: { game },
      orderBy: { createdAt: "desc" },
      include: { sets: { orderBy: { rank: "asc" } } },
    });
    return run ? this.normalizeRun(run) : null;
  }

  async latestData(game: LotoGame) {
    const [summary, run] = await Promise.all([this.summary(game), this.latestRun(game)]);
    const recentDraws = await this.listDraws(game, 10);
    return {
      ...summary,
      recentResults: recentDraws.map((draw) => draw.mainNumbers),
      generatedSets: run?.sets.map((set) => ({
        mainNumbers: set.mainNumbers,
        bonusNumbers: set.bonusNumbers,
        score: set.score,
      })),
      japaneseSentence: run?.japaneseSentence,
    };
  }

  private normalizeRun(run: {
    id: string;
    game: string;
    targetDrawDate: Date;
    status: string;
    seed: string | null;
    requestedSetCount: number;
    inputConfigJson: unknown;
    algorithmWeightsJson: unknown;
    contextJson: unknown;
    japaneseSentenceJson: unknown;
    createdAt: Date;
    sets: Array<{
      id: string;
      rank: number;
      mainNumbers: number[];
      bonusNumbers: number[];
      score: number;
      explanationJson: unknown;
      selectedForMagazine: boolean;
    }>;
  }) {
    return {
      id: run.id,
      game: run.game,
      targetDrawDate: toDateKey(run.targetDrawDate),
      status: run.status,
      seed: run.seed,
      requestedSetCount: run.requestedSetCount,
      inputConfig: run.inputConfigJson,
      algorithmWeights: run.algorithmWeightsJson,
      context: run.contextJson,
      japaneseSentence: run.japaneseSentenceJson,
      createdAt: run.createdAt.toISOString(),
      sets: run.sets.map((set) => ({
        id: set.id,
        rank: set.rank,
        mainNumbers: set.mainNumbers,
        bonusNumbers: set.bonusNumbers,
        score: set.score,
        explanation: set.explanationJson,
        selectedForMagazine: set.selectedForMagazine,
      })),
    };
  }
}
