import { createPrismaClient, type Prisma } from "@nihongo-bjt/database";
import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger
} from "@nestjs/common";

import { QuotaService } from "../monetization/quota.service.js";
import { EntitlementKey } from "../monetization/monetization.constants.js";
import { EntitlementService } from "../monetization/entitlement.service.js";

type SourceType = "lexeme" | "kanji" | "grammar";
type Direction = "jp_to_vn" | "vn_to_jp" | "both";

interface GenerateDeckInput {
  level: string;
  sourceTypes: SourceType[];
  direction: Direction;
  cardCount: number;
  topics?: string[];
  adaptive: boolean;
  userId: string;
}

interface AdminGenerateDeckInput {
  level: string;
  sourceTypes: SourceType[];
  direction: Direction;
  cardCount: number;
  topics?: string[];
  titleVi: string;
  titleJa?: string;
}

interface PreviewCountInput {
  level: string;
  sourceTypes: SourceType[];
  topics?: string[];
  userId: string;
}

interface ContentCandidate {
  id: string;
  frontText: string;
  backText: string;
  reading?: string;
  sourceType: SourceType;
}

@Injectable()
export class FlashcardGenService {
  private readonly logger = new Logger(FlashcardGenService.name);
  private readonly prisma = createPrismaClient();

  constructor(
    @Inject(QuotaService) private readonly quotaService: QuotaService,
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService
  ) {}

  /** Preview how many cards can be generated for given filters. */
  async previewCount(input: PreviewCountInput) {
    const counts: Record<SourceType, number> = { lexeme: 0, kanji: 0, grammar: 0 };
    const existingSourceIds = await this.existingUserSourceIds(input.userId);

    for (const st of input.sourceTypes) {
      counts[st] = await this.countCandidates(st, input.level, input.topics, existingSourceIds);
    }

    return {
      total: counts.lexeme + counts.kanji + counts.grammar,
      breakdown: counts
    };
  }

  /** Suggest cards for manual deck composition (premium). */
  async suggestCards(input: {
    level: string;
    sourceTypes: SourceType[];
    count: number;
    userId: string;
  }) {
    const hasSuggest = await this.entitlementService.has(
      input.userId,
      EntitlementKey.flashcard_suggest_cards
    );
    if (!hasSuggest) {
      throw new ForbiddenException({
        code: "entitlement_required",
        entitlement: EntitlementKey.flashcard_suggest_cards,
        message: "Card suggestions require a premium plan"
      });
    }

    const candidates = await this.gatherCandidates({
      level: input.level,
      sourceTypes: input.sourceTypes,
      direction: "jp_to_vn",
      cardCount: input.count,
      adaptive: false,
      userId: input.userId
    });

    return {
      suggestions: candidates.map((c) => ({
        front: c.frontText,
        back: c.backText,
        reading: c.reading,
        sourceType: c.sourceType
      }))
    };
  }

  /** Learner auto-generate: creates a private deck with cards from content. */
  async generateForLearner(input: GenerateDeckInput) {
    // Adaptive requires premium entitlement
    if (input.adaptive) {
      const hasAdaptive = await this.entitlementService.has(
        input.userId,
        EntitlementKey.flashcard_adaptive_gen
      );
      if (!hasAdaptive) {
        throw new ForbiddenException({
          code: "entitlement_required",
          entitlement: EntitlementKey.flashcard_adaptive_gen,
          message: "Adaptive card generation requires a premium plan"
        });
      }
    }

    // Quota check (free: 3/day)
    await this.quotaService.consumeFlashcardGen(input.userId);

    const candidates = await this.gatherCandidates(input);
    if (candidates.length === 0) {
      throw new BadRequestException({
        code: "no_content_available",
        message: "No matching content found for the selected filters"
      });
    }

    const deck = await this.buildDeck(
      candidates,
      input.direction,
      {
        titleVi: this.autoTitleVi(input),
        titleJa: this.autoTitleJa(input),
        visibility: "private",
        ownerUserId: input.userId
      },
      input.userId
    );

    // Record gen job
    await this.prisma.flashcardGenJob.create({
      data: {
        userId: input.userId,
        mode: input.adaptive ? "by_weak_area" : input.topics?.length ? "by_topic" : "by_level",
        status: "completed",
        params: this.buildLearnerJobParams(input),
        cardsGenerated: deck.cardCount,
        deckId: deck.id
      }
    });

    return deck;
  }

  /** Admin auto-generate: creates a public curated deck. */
  async generateForAdmin(input: AdminGenerateDeckInput) {
    const candidates = await this.gatherCandidates({
      ...input,
      adaptive: false,
      userId: "" // no user filtering for admin
    });

    if (candidates.length === 0) {
      throw new BadRequestException({
        code: "no_content_available",
        message: "No matching content found for the selected filters"
      });
    }

    const deck = await this.buildDeck(
      candidates,
      input.direction,
      {
        titleVi: input.titleVi,
        titleJa: input.titleJa,
        visibility: "public",
        ownerUserId: undefined
      },
      undefined
    );

    return deck;
  }

  // ── Internal ──

  private buildLearnerJobParams(input: GenerateDeckInput): Prisma.InputJsonValue {
    return {
      adaptive: input.adaptive,
      direction: input.direction,
      level: input.level,
      sourceTypes: input.sourceTypes,
      ...(input.topics?.length ? { topics: input.topics } : {})
    };
  }

  private async gatherCandidates(input: {
    level: string;
    sourceTypes: SourceType[];
    direction: Direction;
    cardCount: number;
    topics?: string[];
    adaptive: boolean;
    userId: string;
  }): Promise<ContentCandidate[]> {
    const existingSourceIds = input.userId
      ? await this.existingUserSourceIds(input.userId)
      : new Set<string>();

    const all: ContentCandidate[] = [];
    for (const st of input.sourceTypes) {
      const items = await this.fetchCandidates(st, input.level, input.topics, existingSourceIds);
      all.push(...items);
    }

    // Adaptive: prioritize weak areas (lapsed/leeched content)
    if (input.adaptive && input.userId) {
      const weakIds = await this.weakAreaSourceIds(input.userId);
      all.sort((a, b) => {
        const aWeak = weakIds.has(a.id) ? 0 : 1;
        const bWeak = weakIds.has(b.id) ? 0 : 1;
        return aWeak - bWeak;
      });
    } else {
      // Shuffle for variety
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
      }
    }

    return all.slice(0, input.cardCount);
  }

  private async fetchCandidates(
    sourceType: SourceType,
    level: string,
    topics: string[] | undefined,
    existingSourceIds: Set<string>
  ): Promise<ContentCandidate[]> {
    switch (sourceType) {
      case "lexeme":
        return this.fetchLexemeCandidates(level, topics, existingSourceIds);
      case "kanji":
        return this.fetchKanjiCandidates(level, existingSourceIds);
      case "grammar":
        return this.fetchGrammarCandidates(level, topics, existingSourceIds);
    }
  }

  private async fetchLexemeCandidates(
    level: string,
    topics: string[] | undefined,
    exclude: Set<string>
  ): Promise<ContentCandidate[]> {
    const jlptLevel = this.bjtToJlpt(level);
    const rows = await this.prisma.lexeme.findMany({
      where: {
        status: "active",
        jlptLevel,
        ...(topics?.length ? { senses: { some: { partOfSpeech: { in: topics } } } } : {}),
        id: { notIn: [...exclude].slice(0, 5000) }
      },
      include: { senses: { take: 1 } },
      take: 200
    });

    return rows
      .filter((r) => r.shortMeaningVi || r.senses[0]?.meaningVi)
      .map((r) => ({
        id: r.id,
        frontText: r.headword,
        backText: r.shortMeaningVi || r.senses[0]?.meaningVi || "",
        reading: r.reading ?? undefined,
        sourceType: "lexeme" as const
      }));
  }

  private async fetchKanjiCandidates(
    level: string,
    exclude: Set<string>
  ): Promise<ContentCandidate[]> {
    const kanjiLevel = this.bjtToKanjiLevel(level);
    const rows = await this.prisma.kanji.findMany({
      where: {
        status: "active",
        ...(kanjiLevel != null ? { level: kanjiLevel } : {}),
        id: { notIn: [...exclude].slice(0, 5000) }
      },
      take: 200
    });

    return rows
      .filter((r) => r.meaningVi)
      .map((r) => ({
        id: r.id,
        frontText: r.character,
        backText: r.meaningVi!,
        reading: [r.onyomi, r.kunyomi].filter(Boolean).join(" / ") || undefined,
        sourceType: "kanji" as const
      }));
  }

  private async fetchGrammarCandidates(
    level: string,
    topics: string[] | undefined,
    exclude: Set<string>
  ): Promise<ContentCandidate[]> {
    const jlptLevel = this.bjtToJlpt(level);
    const rows = await this.prisma.grammarPoint.findMany({
      where: {
        status: "active",
        jlptLevel,
        ...(topics?.length ? { category: { in: topics } } : {}),
        id: { notIn: [...exclude].slice(0, 5000) }
      },
      take: 200
    });

    return rows.map((r) => ({
      id: r.id,
      frontText: r.pattern,
      backText: r.meaningVi,
      sourceType: "grammar" as const
    }));
  }

  private async countCandidates(
    sourceType: SourceType,
    level: string,
    topics: string[] | undefined,
    exclude: Set<string>
  ): Promise<number> {
    const jlptLevel = this.bjtToJlpt(level);
    const kanjiLevel = this.bjtToKanjiLevel(level);
    const excludeIds = [...exclude].slice(0, 5000);

    switch (sourceType) {
      case "lexeme":
        return this.prisma.lexeme.count({
          where: {
            status: "active",
            jlptLevel,
            ...(topics?.length ? { senses: { some: { partOfSpeech: { in: topics } } } } : {}),
            id: { notIn: excludeIds }
          }
        });
      case "kanji":
        return this.prisma.kanji.count({
          where: {
            status: "active",
            ...(kanjiLevel != null ? { level: kanjiLevel } : {}),
            id: { notIn: excludeIds }
          }
        });
      case "grammar":
        return this.prisma.grammarPoint.count({
          where: {
            status: "active",
            jlptLevel,
            ...(topics?.length ? { category: { in: topics } } : {}),
            id: { notIn: excludeIds }
          }
        });
    }
  }

  /** Get source IDs already in user's flashcard decks (for dedup). */
  private async existingUserSourceIds(userId: string): Promise<Set<string>> {
    if (!userId) return new Set();
    const rows = await this.prisma.userFlashcard.findMany({
      where: { userId },
      select: { card: { select: { sourceId: true } } }
    });
    return new Set(rows.map((r) => r.card.sourceId));
  }

  /** Get source IDs where user has lapsed/leeched cards (weak areas). */
  private async weakAreaSourceIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.userFlashcard.findMany({
      where: {
        userId,
        OR: [{ state: "lapsed" }, { leeched: true }]
      },
      select: { card: { select: { sourceId: true, sourceType: true } } }
    });
    // Return the source content IDs that need reinforcement
    const contentSourceIds = new Set<string>();
    for (const r of rows) {
      if (["lexeme", "kanji", "grammar"].includes(r.card.sourceType)) {
        contentSourceIds.add(r.card.sourceId);
      }
    }
    return contentSourceIds;
  }

  private async buildDeck(
    candidates: ContentCandidate[],
    direction: Direction,
    deckMeta: {
      titleVi: string;
      titleJa?: string;
      visibility: "private" | "public";
      ownerUserId?: string;
    },
    userId: string | undefined
  ) {
    return this.prisma.$transaction(async (tx) => {
      const deck = await tx.deck.create({
        data: {
          titleVi: deckMeta.titleVi,
          titleJa: deckMeta.titleJa,
          visibility: deckMeta.visibility,
          ownerUserId: deckMeta.ownerUserId
        }
      });

      let position = 0;
      const cards: Array<{ direction: "jp_to_vn" | "vn_to_jp"; candidate: ContentCandidate }> = [];

      for (const c of candidates) {
        if (direction === "both") {
          cards.push({ direction: "jp_to_vn", candidate: c });
          cards.push({ direction: "vn_to_jp", candidate: c });
        } else {
          cards.push({ direction, candidate: c });
        }
      }

      for (const { direction: dir, candidate: c } of cards) {
        const isReverse = dir === "vn_to_jp";
        const card = await tx.flashcardVariant.create({
          data: {
            frontText: isReverse ? c.backText : c.frontText,
            backText: isReverse ? c.frontText : c.backText,
            reading: isReverse ? undefined : c.reading,
            sourceType: c.sourceType,
            sourceId: c.id
          }
        });

        await tx.deckCard.create({
          data: { deckId: deck.id, cardId: card.id, position: position++ }
        });

        if (userId) {
          await tx.userFlashcard.create({
            data: { userId, cardId: card.id }
          });
        }
      }

      return { id: deck.id, titleVi: deckMeta.titleVi, cardCount: position };
    });
  }

  // ── Level mapping helpers ──

  /** Map BJT level (J5-J1+) to JLPT level string (N5-N1). */
  private bjtToJlpt(bjtLevel: string): string {
    const map: Record<string, string> = {
      J5: "N5", J4: "N4", J3: "N3", J2: "N2", J1: "N1", "J1+": "N1"
    };
    return map[bjtLevel.toUpperCase()] ?? bjtLevel;
  }

  /** Map BJT level to kanji level (integer). */
  private bjtToKanjiLevel(bjtLevel: string): number | null {
    const map: Record<string, number> = {
      J5: 5, J4: 4, J3: 3, J2: 2, J1: 1, "J1+": 1
    };
    return map[bjtLevel.toUpperCase()] ?? null;
  }

  private autoTitleVi(input: GenerateDeckInput): string {
    const parts = [`${input.level}`];
    for (const st of input.sourceTypes) {
      const labels: Record<string, string> = { lexeme: "Từ vựng", kanji: "Kanji", grammar: "Ngữ pháp" };
      parts.push(labels[st] ?? st);
    }
    if (input.adaptive) parts.push("(điểm yếu)");
    return parts.join(" — ");
  }

  private autoTitleJa(input: GenerateDeckInput): string {
    const parts = [`${input.level}`];
    for (const st of input.sourceTypes) {
      const labels: Record<string, string> = { lexeme: "語彙", kanji: "漢字", grammar: "文法" };
      parts.push(labels[st] ?? st);
    }
    if (input.adaptive) parts.push("(弱点)");
    return parts.join("—");
  }
}
