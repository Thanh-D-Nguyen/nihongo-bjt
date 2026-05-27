import { Injectable } from "@nestjs/common";
import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import type { LotoGame } from "./loto-types.js";

interface PredictionFeedItem {
  id: string;
  drawNumber: number | null;
  drawDate: string;
  game: LotoGame;
  sets: Array<{ mainNumbers: number[]; bonusNumbers: number[]; score: number }>;
  result: { mainNumbers: number[]; bonusNumbers: number[] } | null;
  hitCount: number;
  bonusHit: boolean;
  jpSentence: { textJp: string; reading: string; textVi: string; vocabItems: Array<{ wordJp: string; reading: string; meaningVi: string }> } | null;
  approvalStatus: string;
  publishedAt: string | null;
}

function computeHits(predicted: number[], actual: number[]): { hitCount: number; hits: number[] } {
  const actualSet = new Set(actual);
  const hits = predicted.filter((n) => actualSet.has(n));
  return { hitCount: hits.length, hits };
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class LotoHubService {
  private readonly prisma: PrismaClient = createPrismaClient();

  async feed(game: LotoGame, page: number, limit: number) {
    const widgetKind = `magazine_${game}`;

    const [articles, total] = await Promise.all([
      this.prisma.magazineArticle.findMany({
        where: {
          widgetKind,
          status: "published",
          approvalStatus: { in: ["approved", "auto_approved"] },
        },
        orderBy: { contentDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          vocabItems: { orderBy: { displayOrder: "asc" } },
        },
      }),
      this.prisma.magazineArticle.count({
        where: {
          widgetKind,
          status: "published",
          approvalStatus: { in: ["approved", "auto_approved"] },
        },
      }),
    ]);

    // Fetch matching draw results for the date range
    const dates = articles.map((a) => a.contentDate);
    const draws = dates.length
      ? await this.prisma.lotoDraw.findMany({
          where: { game, drawDate: { in: dates } },
        })
      : [];
    const drawByDate = new Map(draws.map((d) => [toDateKey(d.drawDate), d]));

    const data: PredictionFeedItem[] = articles.map((article) => {
      const content = article.contentJson as any;
      const sets: Array<{ mainNumbers: number[]; bonusNumbers: number[]; score: number }> =
        content?.sets ?? content?.generatedSets ?? [];
      const jpSentence = content?.japaneseSentence ?? content?.jpSentence ?? null;
      const result = drawByDate.get(toDateKey(article.contentDate)) ?? null;

      const primarySet = sets[0];
      const { hitCount, hits } = primarySet && result
        ? computeHits(primarySet.mainNumbers, result.mainNumbers)
        : { hitCount: 0, hits: [] as number[] };

      const bonusHit = primarySet && result
        ? result.bonusNumbers.some((b) => primarySet.mainNumbers.includes(b))
        : false;

      return {
        id: article.id,
        drawNumber: content?.drawNumber ?? null,
        drawDate: toDateKey(article.contentDate),
        game,
        sets,
        result: result ? { mainNumbers: result.mainNumbers, bonusNumbers: result.bonusNumbers } : null,
        hitCount,
        bonusHit,
        jpSentence,
        approvalStatus: article.approvalStatus,
        publishedAt: article.publishedAt?.toISOString() ?? null,
      };
    });

    return { data, total, page, limit };
  }

  async nextDraw(game: LotoGame) {
    const widgetKind = `magazine_${game}`;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Find prediction for today or future
    const article = await this.prisma.magazineArticle.findFirst({
      where: {
        widgetKind,
        status: "published",
        approvalStatus: { in: ["approved", "auto_approved"] },
        contentDate: { gte: today },
      },
      orderBy: { contentDate: "asc" },
      include: {
        vocabItems: { orderBy: { displayOrder: "asc" } },
      },
    });

    if (!article) return null;

    const content = article.contentJson as any;
    const sets = content?.sets ?? content?.generatedSets ?? [];
    const jpSentence = content?.japaneseSentence ?? content?.jpSentence ?? null;
    const drawDate = toDateKey(article.contentDate);

    // Countdown in days
    const drawDateObj = new Date(drawDate + "T00:00:00.000Z");
    const nowDate = new Date();
    nowDate.setUTCHours(0, 0, 0, 0);
    const daysUntil = Math.max(0, Math.round((drawDateObj.getTime() - nowDate.getTime()) / 86400000));

    return {
      id: article.id,
      drawNumber: content?.drawNumber ?? null,
      drawDate,
      game,
      sets,
      jpSentence,
      vocabItems: article.vocabItems.map((v) => ({
        wordJp: v.wordJp,
        reading: v.reading,
        meaningVi: v.meaningVi,
      })),
      confidence: sets[0]?.score ?? null,
      daysUntil,
    };
  }

  async stats(game: LotoGame) {
    const widgetKind = `magazine_${game}`;

    // Get all published predictions
    const articles = await this.prisma.magazineArticle.findMany({
      where: {
        widgetKind,
        status: "published",
        approvalStatus: { in: ["approved", "auto_approved"] },
      },
      orderBy: { contentDate: "desc" },
      take: 100,
    });

    // Get all draws for matching
    const dates = articles.map((a) => a.contentDate);
    const draws = dates.length
      ? await this.prisma.lotoDraw.findMany({
          where: { game, drawDate: { in: dates } },
        })
      : [];
    const drawByDate = new Map(draws.map((d) => [toDateKey(d.drawDate), d]));

    let totalPredictions = 0;
    let matchedPredictions = 0;
    let totalHits = 0;
    let bestHitCount = 0;
    let bestDrawNumber: number | null = null;
    let currentStreak = 0;
    let maxStreak = 0;
    let streakActive = true;

    for (const article of articles) {
      const content = article.contentJson as any;
      const sets = content?.sets ?? content?.generatedSets ?? [];
      const primarySet = sets[0];
      if (!primarySet) continue;

      totalPredictions++;
      const result = drawByDate.get(toDateKey(article.contentDate));
      if (!result) continue;

      matchedPredictions++;
      const { hitCount } = computeHits(primarySet.mainNumbers, result.mainNumbers);
      totalHits += hitCount;

      if (hitCount > bestHitCount) {
        bestHitCount = hitCount;
        bestDrawNumber = result.drawNumber;
      }

      // Streak: count consecutive draws with ≥ 2 hits
      if (streakActive && hitCount >= 2) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        streakActive = false;
      }
    }

    const avgHitRate = matchedPredictions > 0 ? +(totalHits / matchedPredictions).toFixed(2) : 0;

    return {
      game,
      totalPredictions,
      matchedPredictions,
      avgHitRate,
      bestHitCount,
      bestDrawNumber,
      currentStreak,
      maxStreak,
    };
  }
}
