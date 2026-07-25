import { createPrismaClient, type Prisma } from "@nihongo-bjt/database";
import { readingAssistDisplayModeSchema } from "@nihongo-bjt/shared";
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { z } from "zod";

import { AnalyticsRepository } from "../analytics/analytics.repository.js";
import { FlashcardsRepository } from "../flashcards/flashcards.repository.js";
import { DictionaryLookupService } from "./dictionary-lookup.service.js";
import {
  katakanaToHiragana,
  sha256Hex,
  tokenizeJapanese,
  type KuromojiToken
} from "./japanese-morphology.js";
import { type BjtReadingExamContext, shouldHideVocabularyMeanings } from "./reading-exam.guard.js";

const TOKENIZER_VERSION = "kuromoji-0.1.2";

export type AnalyzedToken = {
  basicForm: string;
  end: number;
  index: number;
  lexemeId: string | null;
  meaningHidden?: boolean;
  partOfSpeech: string;
  reading: string;
  shortMeaningVi: string | null;
  start: number;
  surface: string;
};

type DisplayMode = z.infer<typeof readingAssistDisplayModeSchema>;

/**
 * Server-side **reading assist** pipeline: tokenize → dictionary lookup → cache by text hash. Exam modes
 * control whether glosses are returned — see `shouldHideVocabularyMeanings` / `analyze` + `applyExamStrip`.
 */
@Injectable()
export class ReadingAssistService implements OnModuleInit {
  private readonly logger = new Logger(ReadingAssistService.name);
  private readonly prisma = createPrismaClient();

  constructor(
    @Inject(AnalyticsRepository) private readonly analytics: AnalyticsRepository,
    @Inject(DictionaryLookupService) private readonly dictionary: DictionaryLookupService,
    @Inject(FlashcardsRepository) private readonly flashcards: FlashcardsRepository
  ) {}

  async onModuleInit() {
    // Move Kuromoji's dictionary build to application startup instead of the
    // learner's first BJT question request.
    try {
      await tokenizeJapanese("日本語");
    } catch (error) {
      this.logger.warn(
        `Reading tokenizer warm-up failed; the first request will retry: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
    }
  }

  async getPreference(userId: string) {
    const row = await this.prisma.readingUserPreference.findUnique({ where: { userId } });
    return {
      displayMode: (row?.displayMode as DisplayMode) ?? "hover",
      showRomaji: row?.showRomaji ?? false
    };
  }

  async updatePreference(input: {
    displayMode: DisplayMode;
    showRomaji?: boolean;
    userId: string;
  }) {
    return this.prisma.readingUserPreference.upsert({
      create: {
        displayMode: input.displayMode,
        showRomaji: input.showRomaji ?? false,
        userId: input.userId
      },
      update: {
        displayMode: input.displayMode,
        ...(input.showRomaji === undefined ? {} : { showRomaji: input.showRomaji })
      },
      where: { userId: input.userId }
    });
  }

  /**
   * Analysis is cached by **normalized text hash** (no PII in cache key). `examContext` only affects the
   * response payload, not the stored JSON, so timed BJT cannot leak meanings via a warm cache from another mode.
   */
  async analyze(input: {
    examContext?: BjtReadingExamContext;
    quizSessionId?: string;
    userId: string;
    text: string;
  }) {
    let normalized: string;
    let spans: Array<{ end: number; start: number; token: KuromojiToken }>;
    try {
      const tokenized = await tokenizeJapanese(input.text);
      normalized = tokenized.normalized;
      spans = tokenized.spans;
    } catch {
      const safe = input.text.trim();
      return { cached: false, normalized: safe, textHash: sha256Hex(safe), tokens: [] };
    }
    if (!normalized) {
      return { cached: false, normalized: "", textHash: sha256Hex(""), tokens: [] };
    }
    const textHash = sha256Hex(normalized);
    const [cacheRow, hide] = await Promise.all([
      this.prisma.readingTextAnalysis.findUnique({ where: { textHash } }),
      this.resolveHideMeanings(input)
    ]);

    if (cacheRow) {
      const body = this.applyExamStrip(cacheRow.resultJson as AnalyzedResultPayload, hide);
      return {
        cached: true,
        normalized,
        textHash,
        tokens: body.tokens,
        tokenizerVersion: cacheRow.tokenizerVersion
      };
    }

    const dictionaryRows = await this.dictionary.lookupForTokens(
      spans.map(({ token }) => token)
    );
    const tokens: AnalyzedToken[] = spans.map(({ end, start, token }, index) => ({
      basicForm: token.basic_form,
      end,
      index,
      lexemeId: dictionaryRows[index]?.lexemeId ?? null,
      partOfSpeech: token.pos,
      reading: katakanaToHiragana(token.reading) || token.surface_form,
      shortMeaningVi: dictionaryRows[index]?.shortMeaningVi ?? null,
      start,
      surface: token.surface_form
    }));

    const payload: AnalyzedResultPayload = { tokens, version: 1 };
    const resultJson = payload as unknown as Prisma.InputJsonValue;
    await this.prisma.readingTextAnalysis.upsert({
      create: { resultJson, textHash, tokenizerVersion: TOKENIZER_VERSION },
      update: { resultJson, tokenizerVersion: TOKENIZER_VERSION },
      where: { textHash }
    });

    await this.analytics.ingest({
      eventName: "reading_assist_cache_miss",
      payload: { textHash, tokenizerVersion: TOKENIZER_VERSION },
      source: "api",
      userId: input.userId
    });

    return {
      cached: false,
      normalized,
      textHash,
      tokens: this.applyExamStrip({ ...payload, tokens }, hide).tokens,
      tokenizerVersion: TOKENIZER_VERSION
    };
  }

  private async resolveHideMeanings(input: {
    examContext?: BjtReadingExamContext;
    quizSessionId?: string;
    userId: string;
  }): Promise<boolean> {
    if (input.quizSessionId) {
      const session = await this.prisma.quizSession.findFirst({
        select: { status: true },
        where: { id: input.quizSessionId, userId: input.userId }
      });
      if (session) {
        return session.status !== "completed";
      }
    }

    // Replay protection: do not allow meaning leakage while any active quiz session exists.
    const activeQuiz = await this.prisma.quizSession.findFirst({
      select: { id: true },
      where: { status: "in_progress", userId: input.userId }
    });
    if (activeQuiz) {
      return true;
    }

    return shouldHideVocabularyMeanings(input.examContext);
  }

  private applyExamStrip(data: AnalyzedResultPayload, hide: boolean) {
    if (!hide) {
      return data;
    }
    return {
      ...data,
      tokens: data.tokens.map((t) => ({
        ...t,
        meaningHidden: true,
        shortMeaningVi: null
      }))
    };
  }

  async addCardFromReading(input: {
    backText: string;
    deckId: string;
    frontText: string;
    reading?: string;
    userId: string;
  }) {
    return this.flashcards.createCardFromReadingAssist(input);
  }

  async reportIssue(input: { context?: string; kind: string; textHash: string; userId?: string }) {
    return this.prisma.readingAssistReport.create({
      data: {
        context: input.context,
        kind: input.kind,
        textHash: input.textHash,
        userId: input.userId
      }
    });
  }

  /**
   * Lightweight reading generation: tokenize Japanese text and return concatenated hiragana reading.
   * No dictionary lookup, no caching — designed for real-time deck composer auto-fill.
   */
  async getReadings(text: string): Promise<{ reading: string }> {
    if (!text.trim()) return { reading: "" };
    try {
      const { spans } = await tokenizeJapanese(text);
      const reading = spans
        .map((s) => {
          const r = s.token.reading;
          return r ? katakanaToHiragana(r) : s.token.surface_form;
        })
        .join("");
      return { reading };
    } catch {
      return { reading: "" };
    }
  }

  async inferAnalytics(input: {
    anonymousId?: string;
    eventName: string;
    params: Record<string, unknown>;
    sessionId?: string;
    userId?: string;
  }) {
    return this.analytics.ingest({
      anonymousId: input.anonymousId,
      eventName: input.eventName,
      payload: input.params,
      sessionId: input.sessionId,
      source: "api",
      userId: input.userId
    });
  }
}

type AnalyzedResultPayload = {
  tokens: AnalyzedToken[];
  version: number;
};
