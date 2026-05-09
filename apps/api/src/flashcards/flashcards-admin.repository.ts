import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";

export type AdminDeckListInput = {
  page: number;
  pageSize: number;
  q?: string;
  visibility?: string;
  status?: string;
};

export type AdminVariantListInput = {
  page: number;
  pageSize: number;
  q?: string;
  sourceType?: string;
  status?: string;
};

const DECK_STATUSES = new Set(["active", "archived", "draft"]);
const VARIANT_STATUSES = new Set(["active", "archived", "draft"]);

@Injectable()
export class FlashcardsAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  /* ----- Decks ----- */
  async listDecks(input: AdminDeckListInput) {
    const where: Prisma.DeckWhereInput = {};
    if (input.status) where.status = input.status;
    if (input.visibility) where.visibility = input.visibility;
    if (input.q) {
      where.OR = [
        { titleVi: { contains: input.q, mode: "insensitive" } },
        { titleJa: { contains: input.q, mode: "insensitive" } }
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.deck.findMany({
        include: { _count: { select: { cards: true } } },
        orderBy: { updatedAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.deck.count({ where })
    ]);
    return { items, page: input.page, pageSize: input.pageSize, total };
  }

  async deckDetail(id: string) {
    const row = await this.prisma.deck.findUnique({
      include: { _count: { select: { cards: true } } },
      where: { id }
    });
    if (!row) return null;
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
      where: { targetId: id, targetType: "learning.deck" }
    });
    return { ...row, audit };
  }

  async transitionDeck(input: {
    actorId: string;
    id: string;
    next: "active" | "archived" | "draft";
    reason: string;
  }) {
    if (!DECK_STATUSES.has(input.next)) {
      throw new BadRequestException({ code: "invalid_deck_status", status: input.next });
    }
    const before = await this.prisma.deck.findUnique({ where: { id: input.id } });
    if (!before) throw new NotFoundException("Deck not found");
    const after = await this.prisma.deck.update({
      data: { status: input.next },
      where: { id: input.id }
    });
    await this.prisma.adminAuditLog.create({
      data: {
        action: `admin.flashcards.deck.${input.next === "active" ? "approved" : input.next === "archived" ? "rejected" : "draft"}`,
        actorId: input.actorId,
        after: { status: after.status } as Prisma.InputJsonValue,
        before: { status: before.status } as Prisma.InputJsonValue,
        reason: input.reason,
        targetId: input.id,
        targetType: "learning.deck"
      }
    });
    return this.deckDetail(input.id);
  }

  /* ----- Variants (templates) ----- */
  async listVariants(input: AdminVariantListInput) {
    const where: Prisma.FlashcardVariantWhereInput = {};
    if (input.status) where.status = input.status;
    if (input.sourceType) where.sourceType = input.sourceType;
    if (input.q) {
      where.OR = [
        { frontText: { contains: input.q, mode: "insensitive" } },
        { backText: { contains: input.q, mode: "insensitive" } },
        { reading: { contains: input.q, mode: "insensitive" } }
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.flashcardVariant.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          sourceType: true,
          sourceId: true,
          frontText: true,
          backText: true,
          reading: true,
          status: true,
          createdAt: true,
          updatedAt: true
        },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where
      }),
      this.prisma.flashcardVariant.count({ where })
    ]);
    return { items, page: input.page, pageSize: input.pageSize, total };
  }

  async variantDetail(id: string) {
    const row = await this.prisma.flashcardVariant.findUnique({ where: { id } });
    if (!row) return null;
    const [audit, canonical, candidates] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        include: { actor: { select: { id: true, displayName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
        where: { targetId: id, targetType: "learning.flashcard_variant" }
      }),
      this.resolveVariantCanonical(row),
      this.canonicalCandidates(row.frontText)
    ]);
    const [examples, lexemeExamples] = await Promise.all([
      canonical ? this.examplesForCanonicalSource(canonical.sourceType, canonical.sourceId) : Promise.resolve([]),
      canonical?.sourceType === "lexeme" ? this.lexemeExamplesForAdmin(canonical.sourceId) : Promise.resolve([])
    ]);
    return { ...row, audit, canonical, canonicalCandidates: candidates, examples, lexemeExamples };
  }

  async patchVariant(input: {
    actorId: string;
    id: string;
    frontText?: string;
    backText?: string;
    reading?: string | null;
    reason: string;
  }) {
    const before = await this.prisma.flashcardVariant.findUnique({ where: { id: input.id } });
    if (!before) throw new NotFoundException("Flashcard variant not found");
    const data: Prisma.FlashcardVariantUpdateInput = {};
    if (input.frontText != null) data.frontText = input.frontText;
    if (input.backText != null) data.backText = input.backText;
    if (input.reading !== undefined) data.reading = input.reading;
    const after = await this.prisma.flashcardVariant.update({ data, where: { id: input.id } });
    await this.prisma.adminAuditLog.create({
      data: {
        action: "admin.flashcards.variant.updated",
        actorId: input.actorId,
        after: {
          backText: after.backText,
          frontText: after.frontText,
          reading: after.reading
        } as Prisma.InputJsonValue,
        before: {
          backText: before.backText,
          frontText: before.frontText,
          reading: before.reading
        } as Prisma.InputJsonValue,
        reason: input.reason,
        targetId: input.id,
        targetType: "learning.flashcard_variant"
      }
    });
    return this.variantDetail(input.id);
  }

  async transitionVariant(input: {
    actorId: string;
    id: string;
    next: "active" | "archived" | "draft";
    reason: string;
  }) {
    if (!VARIANT_STATUSES.has(input.next)) {
      throw new BadRequestException({ code: "invalid_variant_status", status: input.next });
    }
    const before = await this.prisma.flashcardVariant.findUnique({ where: { id: input.id } });
    if (!before) throw new NotFoundException("Flashcard variant not found");
    const after = await this.prisma.flashcardVariant.update({
      data: { status: input.next },
      where: { id: input.id }
    });
    await this.prisma.adminAuditLog.create({
      data: {
        action: `admin.flashcards.variant.${input.next === "active" ? "published" : input.next === "archived" ? "archived" : "drafted"}`,
        actorId: input.actorId,
        after: { status: after.status } as Prisma.InputJsonValue,
        before: { status: before.status } as Prisma.InputJsonValue,
        reason: input.reason,
        targetId: input.id,
        targetType: "learning.flashcard_variant"
      }
    });
    return this.variantDetail(input.id);
  }

  async patchVariantSource(input: {
    actorId: string;
    id: string;
    reason: string;
    sourceId: string;
    sourceType: "grammar" | "kanji" | "lexeme";
  }) {
    const before = await this.prisma.flashcardVariant.findUnique({ where: { id: input.id } });
    if (!before) throw new NotFoundException("Flashcard variant not found");
    await this.assertCanonicalSourceExists(input.sourceType, input.sourceId);
    const after = await this.prisma.flashcardVariant.update({
      data: { sourceId: input.sourceId, sourceType: input.sourceType },
      where: { id: input.id }
    });
    await this.prisma.adminAuditLog.create({
      data: {
        action: "admin.flashcards.variant.source_remapped",
        actorId: input.actorId,
        after: { sourceId: after.sourceId, sourceType: after.sourceType } as Prisma.InputJsonValue,
        before: { sourceId: before.sourceId, sourceType: before.sourceType } as Prisma.InputJsonValue,
        reason: input.reason,
        targetId: input.id,
        targetType: "learning.flashcard_variant"
      }
    });
    return this.variantDetail(input.id);
  }

  private async assertCanonicalSourceExists(sourceType: "grammar" | "kanji" | "lexeme", sourceId: string) {
    if (sourceType === "lexeme") {
      const hit = await this.prisma.lexeme.findFirst({ where: { id: sourceId, status: "active" } });
      if (!hit) throw new NotFoundException("Lexeme source not found");
      return;
    }
    if (sourceType === "grammar") {
      const hit = await this.prisma.grammarPoint.findFirst({ where: { id: sourceId, status: "active" } });
      if (!hit) throw new NotFoundException("Grammar source not found");
      return;
    }
    const hit = await this.prisma.kanji.findFirst({ where: { id: sourceId, status: "active" } });
    if (!hit) throw new NotFoundException("Kanji source not found");
  }

  private async resolveVariantCanonical(row: {
    frontText: string;
    sourceId: string;
    sourceType: string;
  }): Promise<{ label: string; sourceId: string; sourceType: "grammar" | "kanji" | "lexeme"; resolvedBy: string } | null> {
    if (["lexeme", "grammar", "kanji"].includes(row.sourceType)) {
      const label = await this.sourceLabel(row.sourceType as "grammar" | "kanji" | "lexeme", row.sourceId);
      return label ? { label, sourceId: row.sourceId, sourceType: row.sourceType as "grammar" | "kanji" | "lexeme", resolvedBy: "stored" } : null;
    }
    const first = (await this.canonicalCandidates(row.frontText))[0];
    return first ? { ...first, resolvedBy: "front_text" } : null;
  }

  private async canonicalCandidates(frontText: string) {
    const q = frontText.trim();
    if (!q) return [];
    const grammarCandidates = grammarPatternCandidates(q);
    const [lexemes, grammar, kanji] = await Promise.all([
      this.prisma.lexeme.findMany({
        orderBy: { headword: "asc" },
        select: { headword: true, id: true, reading: true },
        take: 5,
        where: { status: "active", OR: [{ headword: q }, { reading: q }] }
      }),
      this.prisma.grammarPoint.findMany({
        orderBy: { pattern: "asc" },
        select: { id: true, pattern: true },
        take: 5,
        where: { pattern: { in: grammarCandidates }, status: "active" }
      }),
      this.prisma.kanji.findMany({
        orderBy: { character: "asc" },
        select: { character: true, id: true },
        take: 5,
        where: { character: q, status: "active" }
      })
    ]);
    return [
      ...lexemes.map((item) => ({
        label: item.reading ? `${item.headword}（${item.reading}）` : item.headword,
        sourceId: item.id,
        sourceType: "lexeme" as const
      })),
      ...grammar.map((item) => ({ label: item.pattern, sourceId: item.id, sourceType: "grammar" as const })),
      ...kanji.map((item) => ({ label: item.character, sourceId: item.id, sourceType: "kanji" as const }))
    ];
  }

  private async sourceLabel(sourceType: "grammar" | "kanji" | "lexeme", sourceId: string) {
    if (sourceType === "lexeme") {
      const row = await this.prisma.lexeme.findUnique({ select: { headword: true, reading: true }, where: { id: sourceId } });
      return row ? (row.reading ? `${row.headword}（${row.reading}）` : row.headword) : null;
    }
    if (sourceType === "grammar") {
      const row = await this.prisma.grammarPoint.findUnique({ select: { pattern: true }, where: { id: sourceId } });
      return row?.pattern ?? null;
    }
    const row = await this.prisma.kanji.findUnique({ select: { character: true }, where: { id: sourceId } });
    return row?.character ?? null;
  }

  private async examplesForCanonicalSource(sourceType: "grammar" | "kanji" | "lexeme", sourceId: string) {
    if (sourceType === "lexeme") {
      return this.prisma.exampleSentence.findMany({
        orderBy: { japaneseText: "asc" },
        take: 8,
        where: { lexemeSenseExamples: { some: { sense: { lexemeId: sourceId } } }, status: "active" }
      });
    }
    if (sourceType === "grammar") {
      return this.prisma.exampleSentence.findMany({
        orderBy: { japaneseText: "asc" },
        take: 8,
        where: { grammarDetailExamples: { some: { detail: { grammarPointId: sourceId } } }, status: "active" }
      });
    }
    const rows = await this.prisma.kanjiExample.findMany({
      orderBy: { position: "asc" },
      take: 8,
      where: { kanjiId: sourceId }
    });
    return rows.map((row) => ({
      id: row.id,
      japaneseText: row.word,
      reading: row.reading,
      status: "active",
      translationVi: row.meaningVi
    }));
  }

  private async lexemeExamplesForAdmin(lexemeId: string) {
    const senses = await this.prisma.lexemeSense.findMany({
      include: { exampleLinks: { include: { exampleSentence: true } } },
      orderBy: { position: "asc" },
      where: { lexemeId }
    });
    return senses.flatMap((sense) =>
      sense.exampleLinks
        .filter((link) => link.exampleSentence)
        .map((link) => ({
          exampleSentenceId: link.exampleSentence!.id,
          japaneseText: link.exampleSentence!.japaneseText,
          linkId: link.id,
          reading: link.exampleSentence!.reading,
          senseId: sense.id,
          sensePosition: sense.position,
          status: link.exampleSentence!.status,
          translationVi: link.exampleSentence!.translationVi
        }))
    );
  }
}

function grammarPatternCandidates(value: string) {
  const trimmed = value.trim();
  const withoutWave = trimmed.replace(/^[〜~]/u, "");
  return [...new Set([trimmed, withoutWave, `〜${withoutWave}`, `~${withoutWave}`])];
}
