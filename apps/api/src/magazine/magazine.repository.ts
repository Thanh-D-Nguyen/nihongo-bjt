import { Injectable } from "@nestjs/common";
import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import { todayDateKey } from "@nihongo-bjt/shared";

type ListFilter = {
  widgetKind?: string;
  status?: string;
  locale?: string;
  limit: number;
  page: number;
};

type CreateArticleInput = {
  slug: string;
  widgetKind: string;
  contentDate: Date;
  locale?: string;
  titleJp: string;
  titleVi: string;
  summaryJp?: string;
  summaryVi?: string;
  coverImageUrl?: string;
  contentJson: unknown;
  jlptLevel?: string;
  sourceDataJson?: unknown;
  aiModel?: string;
  generationCostTokens?: number;
  seoTitle?: string;
  seoDescription?: string;
  status?: string;
  publishedAt?: Date;
  vocabItems?: Array<{
    wordJp: string;
    reading: string;
    meaningVi: string;
    pos?: string;
    jlptLevel?: string;
    sentenceJp?: string;
    sentenceVi?: string;
    displayOrder?: number;
  }>;
  quizzes?: Array<{
    questionJp: string;
    questionVi?: string;
    quizType?: string;
    options: unknown;
    correctAnswer: string;
    explanationJp?: string;
    explanationVi?: string;
    displayOrder?: number;
  }>;
};

@Injectable()
export class MagazineRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(filter: ListFilter) {
    const where: Record<string, unknown> = {};
    if (filter.status) where.status = filter.status;
    else where.status = "published";
    if (filter.widgetKind) where.widgetKind = filter.widgetKind;
    if (filter.locale) where.locale = filter.locale;

    const [items, total] = await Promise.all([
      this.prisma.magazineArticle.findMany({
        where,
        orderBy: { contentDate: "desc" },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
        include: { vocabItems: { orderBy: { displayOrder: "asc" } } },
      }),
      this.prisma.magazineArticle.count({ where }),
    ]);

    return { items, total, page: filter.page, limit: filter.limit };
  }

  async getToday(locale = "vi") {
    const today = todayDateKey();
    return this.prisma.magazineArticle.findMany({
      where: { contentDate: new Date(today), locale, status: "published" },
      orderBy: { widgetKind: "asc" },
      include: {
        vocabItems: { orderBy: { displayOrder: "asc" } },
        quizzes: { orderBy: { displayOrder: "asc" } },
      },
    });
  }

  async getBySlug(slug: string) {
    return this.prisma.magazineArticle.findUnique({
      where: { slug },
      include: {
        vocabItems: { orderBy: { displayOrder: "asc" } },
        quizzes: { orderBy: { displayOrder: "asc" } },
      },
    });
  }

  async create(input: CreateArticleInput) {
    return this.prisma.magazineArticle.create({
      data: {
        slug: input.slug,
        widgetKind: input.widgetKind,
        contentDate: input.contentDate,
        locale: input.locale ?? "vi",
        titleJp: input.titleJp,
        titleVi: input.titleVi,
        summaryJp: input.summaryJp,
        summaryVi: input.summaryVi,
        coverImageUrl: input.coverImageUrl,
        contentJson: input.contentJson as any,
        jlptLevel: input.jlptLevel,
        sourceDataJson: input.sourceDataJson as any,
        aiModel: input.aiModel,
        generationCostTokens: input.generationCostTokens,
        seoTitle: input.seoTitle ?? input.titleVi,
        seoDescription: input.seoDescription ?? input.summaryVi,
        status: input.status ?? "published",
        publishedAt: input.status === "published" || !input.status ? new Date() : input.publishedAt,
        vocabItems: input.vocabItems
          ? { createMany: { data: input.vocabItems } }
          : undefined,
        quizzes: input.quizzes
          ? { createMany: { data: input.quizzes } }
          : undefined,
      },
      include: { vocabItems: true, quizzes: true },
    });
  }

  async markRead(userId: string, articleId: string, data?: { quizScore?: number; quizTotal?: number; vocabSavedCount?: number; timeSpentSeconds?: number }) {
    return this.prisma.magazineUserRead.upsert({
      where: { userId_articleId: { userId, articleId } },
      create: { userId, articleId, ...data },
      update: { readAt: new Date(), ...data },
    });
  }

  async delete(id: string) {
    return this.prisma.magazineArticle.delete({ where: { id } });
  }

  async existsForDate(widgetKind: string, contentDate: Date, locale = "vi") {
    const count = await this.prisma.magazineArticle.count({
      where: { widgetKind, contentDate, locale },
    });
    return count > 0;
  }
}
