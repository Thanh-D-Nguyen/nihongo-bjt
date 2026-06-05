import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";

import { parseLotoCsv } from "./loto-csv.js";
import { generateLotoSets, summarizeLotoDraws } from "./loto-engine.js";
import { LOTO_GAME_SPECS, LOTO_SCHEDULE, type LotoDrawInput, type LotoGame, type LotoGenerationInput } from "./loto-types.js";

const DEFAULT_CSV_URLS: Record<LotoGame, string> = {
  loto6: "https://loto6.thekyo.jp/data/loto6.csv",
  loto7: "https://loto7.thekyo.jp/data/loto7.csv",
};

/** JST calendar date (UTC+9, no DST) as YYYY-MM-DD. */
function jstDateKey(at: Date): string {
  return new Date(at.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

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
  id: string;
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
    id: row.id,
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
  private readonly logger = new Logger(LotoLabService.name);

  private csvUrl(game: LotoGame): string {
    const envKey = game === "loto6" ? "LOTO6_CSV_URL" : "LOTO7_CSV_URL";
    const fromEnv = process.env[envKey]?.trim();
    return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_CSV_URLS[game];
  }

  /**
   * Download the official thekyo CSV (Shift_JIS encoded), then upsert only the
   * latest draws (new rows + the last few existing rows to absorb corrections).
   * Returns import counts and the resolved source URL.
   */
  async fetchAndImportCsv(game: LotoGame) {
    const url = this.csvUrl(game);
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(25_000) });
    } catch (e) {
      throw new BadRequestException(`Failed to download ${game} CSV from ${url}: ${e instanceof Error ? e.message : "network error"}`);
    }
    if (!response.ok) {
      throw new BadRequestException(`Source returned ${response.status} for ${game} CSV (${url})`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    // thekyo serves Shift_JIS; decode accordingly so Japanese headers map correctly.
    const csvText = new TextDecoder("shift-jis").decode(buffer);

    let parsed: ReturnType<typeof parseLotoCsv>;
    try {
      parsed = parseLotoCsv(csvText, game);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : "Invalid CSV format");
    }
    if (parsed.length === 0) throw new BadRequestException("CSV contains no valid rows");

    // Incremental: only touch new draws + the last 3 existing ones (corrections).
    const maxExisting = await this.prisma.lotoDraw.aggregate({
      where: { game },
      _max: { drawNumber: true },
    });
    const cutoff = (maxExisting._max.drawNumber ?? 0) - 3;
    const toUpsert = parsed.filter((draw) => draw.drawNumber > cutoff);

    let created = 0;
    let updated = 0;
    for (const draw of toUpsert) {
      const existing = await this.prisma.lotoDraw.findUnique({
        where: { game_drawNumber: { game: draw.game, drawNumber: draw.drawNumber } },
      });
      await this.upsertDraw({ ...draw, sourceUrl: url, sourceProvider: "thekyo_csv" });
      if (existing) updated += 1;
      else created += 1;
    }

    return { game, url, created, updated, processed: toUpsert.length, total: parsed.length };
  }

  /** First scheduled draw date strictly after today (JST), as YYYY-MM-DD. */
  private nextScheduledDrawDate(game: LotoGame): string {
    const drawDays = LOTO_SCHEDULE[game].drawDays;
    const cursor = new Date(`${jstDateKey(new Date())}T00:00:00.000Z`);
    for (let i = 0; i < 14; i += 1) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      if (drawDays.includes(cursor.getUTCDay())) return cursor.toISOString().slice(0, 10);
    }
    // Fallback (should never hit): one week out.
    cursor.setUTCDate(cursor.getUTCDate() + 7);
    return cursor.toISOString().slice(0, 10);
  }

  /** UTC instant for start-of-day (00:00 JST) of the given JST date key. */
  private jstStartOfDayUtc(dateKey: string): Date {
    return new Date(`${dateKey}T00:00:00+09:00`);
  }

  /**
   * Autopilot tick. Designed to be called repeatedly inside a retry window
   * (e.g. every 30 min after the draw). It only publishes once the official
   * result for today's draw has actually appeared in the CSV; otherwise it
   * reports `waiting_result` so the next tick can retry. Idempotent: a second
   * tick after a successful publish reports `already_done`.
   */
  async runAutopilotIfResultReady(game: LotoGame): Promise<{
    status: "skipped_not_draw_day" | "waiting_result" | "already_done" | "published";
    game: LotoGame;
    todayDrawDate: string;
    targetDrawDate?: string;
    imported?: Awaited<ReturnType<LotoLabService["fetchAndImportCsv"]>>;
    runId?: string;
    publishedSlug?: string;
    publishedSet?: number[];
  }> {
    const todayKey = jstDateKey(new Date());
    const todayDow = this.jstStartOfDayUtc(todayKey).getUTCDay();
    if (!LOTO_SCHEDULE[game].drawDays.includes(todayDow)) {
      return { status: "skipped_not_draw_day", game, todayDrawDate: todayKey };
    }

    const imported = await this.fetchAndImportCsv(game);

    // Has today's official result landed in the CSV yet?
    const todayDraw = await this.prisma.lotoDraw.findFirst({
      where: { game, drawDate: this.jstStartOfDayUtc(todayKey) },
    });
    if (!todayDraw) {
      return { status: "waiting_result", game, todayDrawDate: todayKey, imported };
    }

    const targetDrawDate = this.nextScheduledDrawDate(game);

    // Already published a prediction for the next draw during this cycle?
    const existingRun = await this.prisma.lotoGenerationRun.findFirst({
      where: {
        game,
        targetDrawDate: this.jstStartOfDayUtc(targetDrawDate),
        createdAt: { gte: this.jstStartOfDayUtc(todayKey) },
      },
    });
    if (existingRun) {
      return { status: "already_done", game, todayDrawDate: todayKey, targetDrawDate, imported, runId: existingRun.id };
    }

    const run = await this.generate({
      game,
      targetDrawDate,
      setCount: 3,
      seed: `autopilot-${game}-${targetDrawDate}-${Date.now()}`,
    });
    const topSet = run.sets[0];
    if (!topSet) throw new BadRequestException("Generation produced no sets");

    const published = await this.publishToMagazine(run.id, [topSet.id], null);
    this.logger.log(
      `[autopilot:${game}] result ready (draw ${todayDraw.drawNumber}); imported ${imported.created} new / ${imported.updated} updated; published ${published.slug} for ${targetDrawDate}`,
    );
    return {
      status: "published",
      game,
      todayDrawDate: todayKey,
      targetDrawDate,
      imported,
      runId: run.id,
      publishedSlug: published.slug,
      publishedSet: topSet.mainNumbers,
    };
  }

  async importCsv(csvText: string, fallbackGame?: string) {
    let draws: ReturnType<typeof parseLotoCsv>;
    try {
      draws = parseLotoCsv(csvText, fallbackGame ? validateGame(fallbackGame) : undefined);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : "Invalid CSV format");
    }
    if (draws.length === 0) throw new BadRequestException("CSV contains no valid rows");
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

  async publishToMagazine(runId: string, setIds: string[], adminId: string | null) {
    const uniqueSetIds = [...new Set(setIds)];
    const run = await this.prisma.lotoGenerationRun.findUnique({
      where: { id: runId },
      include: { sets: { where: { id: { in: uniqueSetIds } }, orderBy: { rank: "asc" } } },
    });
    if (!run) throw new NotFoundException("Generation run not found");
    if (run.sets.length === 0) throw new BadRequestException("No matching sets found in this run");
    if (run.sets.length !== uniqueSetIds.length) {
      throw new BadRequestException("All selected setIds must belong to the generation run");
    }

    const game = run.game as LotoGame;
    const targetDate = run.targetDrawDate;
    const dateKey = toDateKey(targetDate);
    const widgetKind = `magazine_${game}`;
    const slug = `${game}-prediction-${dateKey}`;
    const schedule = LOTO_SCHEDULE[game];
    const dow = targetDate.getDay();
    const dayJp = ["日", "月", "火", "水", "木", "金", "土"][dow];

    // Build content JSON
    const contentJson = {
      runId,
      game,
      targetDrawDate: dateKey,
      drawDayJp: `${dayJp}曜日`,
      drawTime: schedule.drawTime,
      scheduleJp: schedule.labelJp,
      scheduleVi: schedule.labelVi,
      sets: run.sets.map((s) => ({
        id: s.id,
        rank: s.rank,
        mainNumbers: s.mainNumbers,
        bonusNumbers: s.bonusNumbers,
        score: s.score,
        explanation: s.explanationJson,
      })),
      japaneseSentence: run.japaneseSentenceJson,
      algorithmWeights: run.algorithmWeightsJson,
    };

    const article = await this.prisma.$transaction(async (tx) => {
      await tx.lotoGeneratedSet.updateMany({
        where: { runId },
        data: { selectedForMagazine: false },
      });

      await tx.lotoGeneratedSet.updateMany({
        where: { id: { in: uniqueSetIds }, runId },
        data: { selectedForMagazine: true },
      });

      await tx.lotoGenerationRun.update({
        where: { id: runId },
        data: { selectedSetId: run.sets[0].id },
      });

      // Upsert magazine article (unique on widgetKind + contentDate + locale)
      return tx.magazineArticle.upsert({
        where: {
          widgetKind_contentDate_locale: {
            widgetKind,
            contentDate: targetDate,
            locale: "vi",
          },
        },
        create: {
          slug,
          widgetKind,
          contentDate: targetDate,
          locale: "vi",
          titleJp: `${game.toUpperCase()} 予想 — ${dateKey}（${dayJp}）${schedule.drawTime}`,
          titleVi: `Dự đoán ${game.toUpperCase()} — ${dateKey} • Quay thưởng ${schedule.drawTime}`,
          summaryJp: `${schedule.labelJp}｜AI分析による予想数字`,
          summaryVi: `${schedule.labelVi} | Số dự đoán từ AI`,
          contentJson,
          status: "published",
          approvalStatus: "approved",
          approvedBy: adminId,
          approvedAt: new Date(),
          publishedAt: new Date(),
        },
        update: {
          titleJp: `${game.toUpperCase()} 予想 — ${dateKey}（${dayJp}）${schedule.drawTime}`,
          titleVi: `Dự đoán ${game.toUpperCase()} — ${dateKey} • Quay thưởng ${schedule.drawTime}`,
          summaryJp: `${schedule.labelJp}｜AI分析による予想数字`,
          summaryVi: `${schedule.labelVi} | Số dự đoán từ AI`,
          contentJson,
          status: "published",
          approvalStatus: "approved",
          approvedBy: adminId,
          approvedAt: new Date(),
          publishedAt: new Date(),
        },
      });
    });

    return {
      articleId: article.id,
      slug: article.slug,
      status: article.status,
      publishedAt: article.publishedAt?.toISOString() ?? null,
      selectedSets: run.sets.length,
    };
  }
}
