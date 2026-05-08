import { createPrismaClient, Prisma } from "@nihongo-bjt/database";
import { Injectable } from "@nestjs/common";

@Injectable()
export class CardgenRepository {
  private readonly prisma = createPrismaClient();

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Flashcard Gen Rules (admin) ────────────────────────────────────── */

  async listRules() {
    return this.prisma.flashcardGenRule.findMany({
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }]
    });
  }

  async findRule(id: string) {
    return this.prisma.flashcardGenRule.findUnique({ where: { id } });
  }

  async enabledRules(sourceType?: string) {
    const where: Prisma.FlashcardGenRuleWhereInput = { enabled: true };
    if (sourceType) where.sourceType = sourceType;
    return this.prisma.flashcardGenRule.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }]
    });
  }

  async createRule(data: {
    name: string;
    sourceType: string;
    filterLevel: string | null;
    filterTags: unknown;
    direction: string;
    cardTemplate: unknown;
    includeExamples: boolean;
    includeAudio: boolean;
    enabled: boolean;
    priority: number;
    actorId: string;
  }) {
    return this.prisma.flashcardGenRule.create({
      data: {
        name: data.name,
        sourceType: data.sourceType,
        filterLevel: data.filterLevel,
        filterTags: data.filterTags as Prisma.InputJsonValue,
        direction: data.direction,
        cardTemplate: data.cardTemplate as Prisma.InputJsonValue,
        includeExamples: data.includeExamples,
        includeAudio: data.includeAudio,
        enabled: data.enabled,
        priority: data.priority,
        createdBy: data.actorId,
        updatedBy: data.actorId
      }
    });
  }

  async updateRule(
    id: string,
    data: {
      name: string;
      sourceType: string;
      filterLevel: string | null;
      filterTags: unknown;
      direction: string;
      cardTemplate: unknown;
      includeExamples: boolean;
      includeAudio: boolean;
      enabled: boolean;
      priority: number;
      actorId: string;
    }
  ) {
    return this.prisma.flashcardGenRule.update({
      where: { id },
      data: {
        name: data.name,
        sourceType: data.sourceType,
        filterLevel: data.filterLevel,
        filterTags: data.filterTags as Prisma.InputJsonValue,
        direction: data.direction,
        cardTemplate: data.cardTemplate as Prisma.InputJsonValue,
        includeExamples: data.includeExamples,
        includeAudio: data.includeAudio,
        enabled: data.enabled,
        priority: data.priority,
        updatedBy: data.actorId
      }
    });
  }

  async deleteRule(id: string) {
    return this.prisma.flashcardGenRule.delete({ where: { id } });
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Flashcard Gen Jobs ─────────────────────────────────────────────── */

  async createJob(data: {
    ruleId: string | null;
    userId: string | null;
    mode: string;
    params: unknown;
  }) {
    return this.prisma.flashcardGenJob.create({
      data: {
        ruleId: data.ruleId,
        userId: data.userId,
        mode: data.mode,
        params: data.params as Prisma.InputJsonValue,
        status: "pending"
      }
    });
  }

  async updateJobStatus(
    id: string,
    data: {
      status: string;
      cardsGenerated?: number;
      deckId?: string | null;
      errorMessage?: string | null;
      startedAt?: Date;
      completedAt?: Date;
    }
  ) {
    return this.prisma.flashcardGenJob.update({
      where: { id },
      data
    });
  }

  async findJob(id: string) {
    return this.prisma.flashcardGenJob.findUnique({
      where: { id },
      include: { rule: true }
    });
  }

  async userJobs(userId: string, limit: number) {
    return this.prisma.flashcardGenJob.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { rule: true }
    });
  }

  async listJobs(limit: number) {
    return this.prisma.flashcardGenJob.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { rule: true }
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Content Queries (source material for card generation) ──────────── */

  async queryLexemes(filters: {
    level?: string;
    tags?: string[];
    limit: number;
    excludeSourceIds?: string[];
  }) {
    const where: Prisma.LexemeWhereInput = { status: "active" };
    if (filters.level) where.jlptLevel = filters.level;
    if (filters.excludeSourceIds?.length) {
      where.id = { notIn: filters.excludeSourceIds };
    }

    return this.prisma.lexeme.findMany({
      where,
      take: filters.limit,
      orderBy: { createdAt: "desc" },
      include: {
        senses: {
          take: 1,
          orderBy: { position: "asc" },
          include: {
            exampleLinks: {
              take: 1,
              include: { exampleSentence: true }
            }
          }
        }
      }
    });
  }

  async queryGrammarPoints(filters: {
    level?: string;
    tags?: string[];
    limit: number;
    excludeSourceIds?: string[];
  }) {
    const where: Prisma.GrammarPointWhereInput = { status: "active" };
    if (filters.level) where.jlptLevel = filters.level;
    if (filters.excludeSourceIds?.length) {
      where.id = { notIn: filters.excludeSourceIds };
    }

    return this.prisma.grammarPoint.findMany({
      where,
      take: filters.limit,
      orderBy: { createdAt: "desc" },
      include: {
        details: {
          take: 1,
          include: {
            exampleLinks: {
              take: 1,
              include: { exampleSentence: true }
            }
          }
        }
      }
    });
  }

  async queryKanji(filters: {
    level?: string;
    tags?: string[];
    limit: number;
    excludeSourceIds?: string[];
  }) {
    const where: Prisma.KanjiWhereInput = { status: "active" };
    if (filters.level) {
      const numericLevel = Number(filters.level.replace(/^N/u, ""));
      if (Number.isInteger(numericLevel)) {
        where.level = numericLevel;
      }
    }
    if (filters.excludeSourceIds?.length) {
      where.id = { notIn: filters.excludeSourceIds };
    }

    return this.prisma.kanji.findMany({
      where,
      take: filters.limit,
      orderBy: { createdAt: "desc" }
    });
  }

  /** Find cards the user has struggled with (high lapse count, low ease) */
  async queryWeakCards(userId: string, limit: number) {
    return this.prisma.userFlashcard.findMany({
      where: {
        userId,
        OR: [{ lapses: { gte: 3 } }, { easeFactor: { lt: 1.8 } }]
      },
      orderBy: [{ lapses: "desc" }, { easeFactor: "asc" }],
      take: limit,
      include: {
        card: true
      }
    });
  }

  /** Find source IDs of cards the user already has to avoid duplicates */
  async existingUserCardSourceIds(userId: string, sourceType: string) {
    const cards = await this.prisma.userFlashcard.findMany({
      where: { userId },
      select: {
        card: { select: { sourceType: true, sourceId: true } }
      }
    });
    return cards
      .filter((c) => c.card.sourceType === sourceType)
      .map((c) => c.card.sourceId);
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Deck + Card Creation (transactional) ───────────────────────────── */

  async createDeckWithCards(data: {
    userId: string;
    titleVi: string;
    titleJa?: string;
    descriptionVi?: string;
    cards: Array<{
      frontText: string;
      backText: string;
      reading?: string;
      sourceType: string;
      sourceId: string;
    }>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const deck = await tx.deck.create({
        data: {
          ownerUserId: data.userId,
          titleVi: data.titleVi,
          titleJa: data.titleJa,
          descriptionVi: data.descriptionVi,
          visibility: "private",
          status: "active"
        }
      });

      for (let i = 0; i < data.cards.length; i++) {
        const c = data.cards[i];
        const variant = await tx.flashcardVariant.create({
          data: {
            sourceType: c.sourceType,
            sourceId: c.sourceId,
            frontText: c.frontText,
            backText: c.backText,
            reading: c.reading,
            status: "active"
          }
        });

        await tx.deckCard.create({
          data: {
            deckId: deck.id,
            cardId: variant.id,
            position: i
          }
        });

        await tx.userFlashcard.create({
          data: {
            userId: data.userId,
            cardId: variant.id,
            state: "new",
            intervalDays: 0,
            easeFactor: 2.5,
            repetitions: 0,
            lapses: 0
          }
        });
      }

      return deck;
    });
  }
}
