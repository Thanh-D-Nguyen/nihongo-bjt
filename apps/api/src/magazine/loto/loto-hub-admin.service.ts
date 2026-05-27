import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import { LOTO_GAME_SPECS, type LotoGame } from "./loto-types.js";

function toDateOnly(value: string | Date): Date {
  const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : value;
  if (Number.isNaN(date.getTime())) throw new BadRequestException("Invalid date");
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeHits(predicted: number[], actual: number[]): number {
  const actualSet = new Set(actual);
  return predicted.filter((n) => actualSet.has(n)).length;
}

@Injectable()
export class LotoHubAdminService {
  private readonly prisma: PrismaClient = createPrismaClient();

  async listPredictions(game: LotoGame, approvalStatus: string | undefined, page: number, limit: number) {
    const widgetKind = `magazine_${game}`;
    const where: Record<string, unknown> = { widgetKind };
    if (approvalStatus) where.approvalStatus = approvalStatus;

    const [items, total] = await Promise.all([
      this.prisma.magazineArticle.findMany({
        where,
        orderBy: { contentDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          vocabItems: { orderBy: { displayOrder: "asc" } },
        },
      }),
      this.prisma.magazineArticle.count({ where }),
    ]);

    return {
      data: items.map((a) => ({
        id: a.id,
        slug: a.slug,
        widgetKind: a.widgetKind,
        titleJp: a.titleJp,
        titleVi: a.titleVi,
        contentDate: toDateKey(a.contentDate),
        status: a.status,
        approvalStatus: a.approvalStatus,
        approvedBy: a.approvedBy,
        approvedAt: a.approvedAt?.toISOString() ?? null,
        contentJson: a.contentJson,
        vocabItems: a.vocabItems,
        createdAt: a.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  async approve(articleId: string, adminId: string) {
    const article = await this.prisma.magazineArticle.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException("Prediction not found");
    if (!article.widgetKind.startsWith("magazine_loto")) {
      throw new BadRequestException("Not a loto prediction article");
    }

    const updated = await this.prisma.magazineArticle.update({
      where: { id: articleId },
      data: {
        approvalStatus: "approved",
        approvedBy: adminId,
        approvedAt: new Date(),
        status: "published",
        publishedAt: article.publishedAt ?? new Date(),
      },
    });

    return { id: updated.id, approvalStatus: updated.approvalStatus, status: updated.status };
  }

  async reject(articleId: string) {
    const article = await this.prisma.magazineArticle.findUnique({ where: { id: articleId } });
    if (!article) throw new NotFoundException("Prediction not found");
    if (!article.widgetKind.startsWith("magazine_loto")) {
      throw new BadRequestException("Not a loto prediction article");
    }

    const updated = await this.prisma.magazineArticle.update({
      where: { id: articleId },
      data: {
        approvalStatus: "rejected",
        status: "draft",
      },
    });

    return { id: updated.id, approvalStatus: updated.approvalStatus, status: updated.status };
  }

  async inputResult(body: { game: string; drawNumber: number; drawDate: string; mainNumbers: number[]; bonusNumbers: number[] }) {
    const game = body.game as LotoGame;
    const spec = LOTO_GAME_SPECS[game];
    if (!spec) throw new BadRequestException("Invalid game");
    if (body.mainNumbers.length !== spec.mainCount) {
      throw new BadRequestException(`${game} requires exactly ${spec.mainCount} main numbers`);
    }
    if (body.bonusNumbers.length !== spec.bonusCount) {
      throw new BadRequestException(`${game} requires exactly ${spec.bonusCount} bonus numbers`);
    }

    const drawDate = toDateOnly(body.drawDate);

    const result = await this.prisma.lotoDraw.upsert({
      where: { game_drawNumber: { game, drawNumber: body.drawNumber } },
      create: {
        game,
        drawNumber: body.drawNumber,
        drawDate,
        mainNumbers: body.mainNumbers,
        bonusNumbers: body.bonusNumbers,
        sourceProvider: "admin_input",
      },
      update: {
        drawDate,
        mainNumbers: body.mainNumbers,
        bonusNumbers: body.bonusNumbers,
        sourceProvider: "admin_input",
      },
    });

    return {
      id: result.id,
      game: result.game,
      drawNumber: result.drawNumber,
      drawDate: toDateKey(result.drawDate),
      mainNumbers: result.mainNumbers,
      bonusNumbers: result.bonusNumbers,
    };
  }

  async analytics(game: LotoGame) {
    const widgetKind = `magazine_${game}`;

    const articles = await this.prisma.magazineArticle.findMany({
      where: { widgetKind, status: "published" },
      orderBy: { contentDate: "desc" },
      take: 200,
    });

    const dates = articles.map((a) => a.contentDate);
    const draws = dates.length
      ? await this.prisma.lotoDraw.findMany({ where: { game, drawDate: { in: dates } } })
      : [];
    const drawByDate = new Map(draws.map((d) => [toDateKey(d.drawDate), d]));

    let totalPredictions = articles.length;
    let matchedCount = 0;
    let totalHits = 0;
    let bestHit = 0;
    let bestDrawNumber: number | null = null;
    const hitDistribution: Record<number, number> = {};

    for (const article of articles) {
      const content = article.contentJson as any;
      const sets = content?.sets ?? content?.generatedSets ?? [];
      const primarySet = sets[0];
      if (!primarySet) continue;

      const result = drawByDate.get(toDateKey(article.contentDate));
      if (!result) continue;

      matchedCount++;
      const hits = computeHits(primarySet.mainNumbers, result.mainNumbers);
      totalHits += hits;
      hitDistribution[hits] = (hitDistribution[hits] ?? 0) + 1;

      if (hits > bestHit) {
        bestHit = hits;
        bestDrawNumber = result.drawNumber;
      }
    }

    const avgHitRate = matchedCount > 0 ? +(totalHits / matchedCount).toFixed(2) : 0;

    // User read stats (views)
    const articleIds = articles.map((a) => a.id);
    const totalViews = articleIds.length
      ? await this.prisma.magazineUserRead.count({
          where: { articleId: { in: articleIds } },
        })
      : 0;

    return {
      game,
      totalPredictions,
      matchedCount,
      avgHitRate,
      bestHit,
      bestDrawNumber,
      hitDistribution,
      totalViews,
    };
  }
}
