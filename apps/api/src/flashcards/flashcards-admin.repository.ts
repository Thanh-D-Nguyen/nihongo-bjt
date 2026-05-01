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
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
      where: { targetId: id, targetType: "learning.flashcard_variant" }
    });
    return { ...row, audit };
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
}
