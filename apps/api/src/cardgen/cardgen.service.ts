import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";

import { CardgenRepository } from "./cardgen.repository.js";

interface CardData {
  frontText: string;
  backText: string;
  reading?: string;
  sourceType: string;
  sourceId: string;
}

@Injectable()
export class CardgenService {
  private readonly logger = new Logger(CardgenService.name);

  constructor(
    @Inject(CardgenRepository) private readonly repo: CardgenRepository
  ) {}

  /**
   * Generate a flashcard deck from content, driven by mode + filters.
   * Creates a FlashcardGenJob, generates cards, produces a Deck.
   */
  async generateDeck(input: {
    userId: string;
    mode: string;
    sourceType?: string;
    level?: string;
    tags?: string[];
    direction: string;
    count: number;
    ruleId?: string;
  }) {
    // Create job record
    const job = await this.repo.createJob({
      ruleId: input.ruleId ?? null,
      userId: input.userId,
      mode: input.mode,
      params: {
        sourceType: input.sourceType,
        level: input.level,
        tags: input.tags,
        direction: input.direction,
        count: input.count
      }
    });

    await this.repo.updateJobStatus(job.id, {
      status: "running",
      startedAt: new Date()
    });

    try {
      const cards = await this.resolveCards(input);

      if (cards.length === 0) {
        await this.repo.updateJobStatus(job.id, {
          status: "completed",
          cardsGenerated: 0,
          completedAt: new Date()
        });
        throw new BadRequestException(
          "No content found matching the given filters. Try adjusting level/sourceType."
        );
      }

      const titleParts = [
        input.mode === "daily_auto" ? "Daily" : capitalize(input.mode.replace(/_/g, " ")),
        input.sourceType ? capitalize(input.sourceType) : "Mixed",
        input.level ?? "",
        `(${cards.length} cards)`
      ].filter(Boolean);

      const deck = await this.repo.createDeckWithCards({
        userId: input.userId,
        titleVi: titleParts.join(" — "),
        descriptionVi: `Auto-generated ${input.direction} flashcards`,
        cards
      });

      await this.repo.updateJobStatus(job.id, {
        status: "completed",
        cardsGenerated: cards.length,
        deckId: deck.id,
        completedAt: new Date()
      });

      return { job, deck, cardsGenerated: cards.length };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;

      const message = err instanceof Error ? err.message : "Unknown error";
      this.logger.error(`Card generation failed for job ${job.id}: ${message}`);

      await this.repo.updateJobStatus(job.id, {
        status: "failed",
        errorMessage: message,
        completedAt: new Date()
      });

      throw err;
    }
  }

  /** Preview how many cards would be generated (dry run). */
  async previewGeneration(input: {
    mode: string;
    sourceType?: string;
    level?: string;
    tags?: string[];
    direction: string;
    count: number;
    userId?: string;
  }) {
    const cards = await this.resolveCards({
      ...input,
      userId: input.userId ?? "preview"
    });

    return {
      estimatedCards: cards.length,
      sampleCards: cards.slice(0, 5).map((c) => ({
        frontText: c.frontText,
        backText: c.backText,
        reading: c.reading,
        sourceType: c.sourceType
      }))
    };
  }

  /** Get a user's generation job history. */
  async getUserJobs(userId: string, limit: number = 20) {
    return this.repo.userJobs(userId, limit);
  }

  /** Get a specific job. */
  async getJob(id: string) {
    const job = await this.repo.findJob(id);
    if (!job) throw new NotFoundException("Job not found");
    return job;
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Card Resolution (core generation logic) ────────────────────────── */

  private async resolveCards(input: {
    userId: string;
    mode: string;
    sourceType?: string;
    level?: string;
    tags?: string[];
    direction: string;
    count: number;
  }): Promise<CardData[]> {
    switch (input.mode) {
      case "by_level":
        return this.generateByLevel(input);
      case "by_topic":
        return this.generateByTopic(input);
      case "by_weak_area":
        return this.generateByWeakArea(input);
      case "daily_auto":
        return this.generateDailyAuto(input);
      default:
        return this.generateByLevel(input);
    }
  }

  private async generateByLevel(input: {
    userId: string;
    sourceType?: string;
    level?: string;
    direction: string;
    count: number;
  }): Promise<CardData[]> {
    const effectiveSourceType = input.sourceType ?? "lexeme";
    const excludeIds = await this.repo.existingUserCardSourceIds(
      input.userId,
      effectiveSourceType
    );

    return this.queryAndBuildCards({
      sourceType: effectiveSourceType,
      level: input.level,
      direction: input.direction,
      count: input.count,
      excludeSourceIds: excludeIds
    });
  }

  private async generateByTopic(input: {
    userId: string;
    sourceType?: string;
    level?: string;
    tags?: string[];
    direction: string;
    count: number;
  }): Promise<CardData[]> {
    const effectiveSourceType = input.sourceType ?? "lexeme";
    const excludeIds = await this.repo.existingUserCardSourceIds(
      input.userId,
      effectiveSourceType
    );

    return this.queryAndBuildCards({
      sourceType: effectiveSourceType,
      level: input.level,
      tags: input.tags,
      direction: input.direction,
      count: input.count,
      excludeSourceIds: excludeIds
    });
  }

  private async generateByWeakArea(input: {
    userId: string;
    direction: string;
    count: number;
  }): Promise<CardData[]> {
    const weakCards = await this.repo.queryWeakCards(input.userId, input.count);
    const cards: CardData[] = [];

    for (const uf of weakCards) {
      const c = uf.card;
      // Create reverse direction cards for weak items
      if (input.direction === "both" || input.direction === "vn_to_jp") {
        cards.push({
          frontText: c.backText,
          backText: c.frontText,
          reading: c.reading ?? undefined,
          sourceType: c.sourceType,
          sourceId: c.sourceId
        });
      }
      if (
        (input.direction === "both" || input.direction === "jp_to_vn") &&
        cards.length < input.count
      ) {
        cards.push({
          frontText: c.frontText,
          backText: c.backText,
          reading: c.reading ?? undefined,
          sourceType: c.sourceType,
          sourceId: c.sourceId
        });
      }
    }

    return cards.slice(0, input.count);
  }

  private async generateDailyAuto(input: {
    userId: string;
    sourceType?: string;
    level?: string;
    direction: string;
    count: number;
  }): Promise<CardData[]> {
    // Daily auto: mix of new content the user hasn't seen yet
    // Try all source types in order: lexeme, grammar, kanji
    const sourceTypes = input.sourceType
      ? [input.sourceType]
      : ["lexeme", "grammar", "kanji"];
    const cards: CardData[] = [];
    const perType = Math.ceil(input.count / sourceTypes.length);

    for (const st of sourceTypes) {
      if (cards.length >= input.count) break;

      const excludeIds = await this.repo.existingUserCardSourceIds(
        input.userId,
        st
      );
      const typeCards = await this.queryAndBuildCards({
        sourceType: st,
        level: input.level,
        direction: input.direction,
        count: perType,
        excludeSourceIds: excludeIds
      });
      cards.push(...typeCards);
    }

    return cards.slice(0, input.count);
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ── Content → Card Builders ────────────────────────────────────────── */

  private async queryAndBuildCards(params: {
    sourceType: string;
    level?: string;
    tags?: string[];
    direction: string;
    count: number;
    excludeSourceIds?: string[];
  }): Promise<CardData[]> {
    // How many items to fetch: if both directions, each item produces 2 cards
    const multiplier = params.direction === "both" ? 1 : 2;
    const fetchLimit = Math.ceil(params.count * multiplier);

    switch (params.sourceType) {
      case "lexeme":
        return this.buildLexemeCards(params, fetchLimit);
      case "grammar":
        return this.buildGrammarCards(params, fetchLimit);
      case "kanji":
        return this.buildKanjiCards(params, fetchLimit);
      default:
        return this.buildLexemeCards(params, fetchLimit);
    }
  }

  private async buildLexemeCards(
    params: {
      level?: string;
      tags?: string[];
      direction: string;
      count: number;
      excludeSourceIds?: string[];
    },
    fetchLimit: number
  ): Promise<CardData[]> {
    const lexemes = await this.repo.queryLexemes({
      level: params.level,
      tags: params.tags,
      limit: fetchLimit,
      excludeSourceIds: params.excludeSourceIds
    });

    const cards: CardData[] = [];

    for (const lex of lexemes) {
      if (cards.length >= params.count) break;

      const sense = lex.senses[0];
      const meaning = sense?.meaningVi || lex.shortMeaningVi || "";
      if (!meaning) continue;

      const reading = lex.reading ?? undefined;
      const example = sense?.exampleLinks[0]?.exampleSentence;
      const exampleLine = example
        ? `\n例: ${example.japaneseText}`
        : "";

      // JP → VN
      if (params.direction !== "vn_to_jp") {
        cards.push({
          frontText: `${lex.headword}${reading ? `（${reading}）` : ""}${exampleLine}`,
          backText: meaning,
          reading,
          sourceType: "lexeme",
          sourceId: lex.id
        });
      }

      // VN → JP
      if (
        params.direction !== "jp_to_vn" &&
        cards.length < params.count
      ) {
        cards.push({
          frontText: meaning,
          backText: `${lex.headword}${reading ? `（${reading}）` : ""}`,
          reading,
          sourceType: "lexeme",
          sourceId: lex.id
        });
      }
    }

    return cards.slice(0, params.count);
  }

  private async buildGrammarCards(
    params: {
      level?: string;
      tags?: string[];
      direction: string;
      count: number;
      excludeSourceIds?: string[];
    },
    fetchLimit: number
  ): Promise<CardData[]> {
    const points = await this.repo.queryGrammarPoints({
      level: params.level,
      tags: params.tags,
      limit: fetchLimit,
      excludeSourceIds: params.excludeSourceIds
    });

    const cards: CardData[] = [];

    for (const pt of points) {
      if (cards.length >= params.count) break;

      const meaning = pt.meaningVi || "";
      if (!meaning) continue;

      const detail = pt.details[0];
      const example = detail?.exampleLinks[0]?.exampleSentence;
      const exampleLine = example
        ? `\n例: ${example.japaneseText}`
        : "";

      // JP → VN
      if (params.direction !== "vn_to_jp") {
        cards.push({
          frontText: `${pt.pattern}${exampleLine}`,
          backText: meaning,
          sourceType: "grammar",
          sourceId: pt.id
        });
      }

      // VN → JP
      if (
        params.direction !== "jp_to_vn" &&
        cards.length < params.count
      ) {
        cards.push({
          frontText: meaning,
          backText: pt.pattern,
          sourceType: "grammar",
          sourceId: pt.id
        });
      }
    }

    return cards.slice(0, params.count);
  }

  private async buildKanjiCards(
    params: {
      level?: string;
      tags?: string[];
      direction: string;
      count: number;
      excludeSourceIds?: string[];
    },
    fetchLimit: number
  ): Promise<CardData[]> {
    const kanjis = await this.repo.queryKanji({
      level: params.level,
      tags: params.tags,
      limit: fetchLimit,
      excludeSourceIds: params.excludeSourceIds
    });

    const cards: CardData[] = [];

    for (const k of kanjis) {
      if (cards.length >= params.count) break;

      const meaning = k.meaningVi || "";
      if (!meaning) continue;

      const onReading = k.onyomi ?? "";
      const kunReading = k.kunyomi ?? "";
      const readingLine = [onReading, kunReading].filter(Boolean).join(" / ");

      // JP → VN
      if (params.direction !== "vn_to_jp") {
        cards.push({
          frontText: k.character,
          backText: `${meaning}\n${readingLine}`,
          reading: readingLine || undefined,
          sourceType: "kanji",
          sourceId: k.id
        });
      }

      // VN → JP
      if (
        params.direction !== "jp_to_vn" &&
        cards.length < params.count
      ) {
        cards.push({
          frontText: `${meaning}\n${readingLine}`,
          backText: k.character,
          reading: readingLine || undefined,
          sourceType: "kanji",
          sourceId: k.id
        });
      }
    }

    return cards.slice(0, params.count);
  }
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
