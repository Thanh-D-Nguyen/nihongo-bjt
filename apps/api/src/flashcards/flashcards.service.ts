import { createPrismaClient, Prisma } from "@nihongo-bjt/database";
import {
  isLikelyVietnameseLegalDisclaimerOnlyBack,
  repairDailyContentFlashcardBackIfNeeded,
  type SrsRating
} from "@nihongo-bjt/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { SeasonalEventService } from "../gamification/seasonal-event.service.js";
import { QuotaService } from "../monetization/quota.service.js";
import { MediaService } from "../media/media.service.js";
import { FlashcardsRepository } from "./flashcards.repository.js";

/**
 * Learner flashcard flows: due queue + SRS submit. **Quota + SRS + `review_event` must stay in one
 * transaction** (serializable) so daily limits and history cannot drift under concurrency.
 */
@Injectable()
export class FlashcardsService {
  private readonly prisma = createPrismaClient();
  private readonly logger = new Logger(FlashcardsService.name);

  constructor(
    @Inject(FlashcardsRepository) private readonly flashcardsRepository: FlashcardsRepository,
    @Inject(MediaService) private readonly mediaService: MediaService,
    @Inject(QuotaService) private readonly quotaService: QuotaService,
    @Inject(SeasonalEventService) private readonly seasonalEventService: SeasonalEventService
  ) {}

  async deckDetailForLearner(userId: string, deckId: string) {
    const deck = await this.flashcardsRepository.deckDetail(userId, deckId);
    return {
      ...deck,
      cards: await Promise.all(
        deck.cards.map(async (row) => {
          const mediaLinks = row.card.mediaLinks ?? [];
          const imageLink =
            mediaLinks.find((m) => m.role === "primary_image") ??
            mediaLinks.find((m) => m.asset.mimeType.startsWith("image/")) ??
            null;
          const audioLink =
            mediaLinks.find((m) => m.role === "primary_audio") ??
            mediaLinks.find((m) => m.asset.mimeType.startsWith("audio/")) ??
            null;
          const resolveReadUrl = async (link: typeof imageLink) => {
            if (!link) return null;
            if (link.asset.provider === "external_url" && link.asset.sourceUrl?.trim()) {
              return link.asset.sourceUrl.trim();
            }
            return this.mediaService.presignedGetForObjectKey(link.asset.objectKey);
          };
          const [imageReadUrl, audioReadUrl] = await Promise.all([
            resolveReadUrl(imageLink),
            resolveReadUrl(audioLink)
          ]);
          return {
            ...row,
            primaryAudio: audioLink
              ? {
                  assetId: audioLink.assetId,
                  mimeType: audioLink.asset.mimeType,
                  readUrl: audioReadUrl
                }
              : null,
            primaryImage: imageLink
              ? {
                  assetId: imageLink.assetId,
                  mimeType: imageLink.asset.mimeType,
                  readUrl: imageReadUrl
                }
              : null
          };
        })
      )
    };
  }

  async dueReviewsForLearner(userId: string, limit: number, deckId?: string) {
    const rows = await this.flashcardsRepository.dueReviews(userId, limit, deckId);
    const dailyRows = rows.filter((r) => r.card.sourceType === "daily_content");
    const dailySourceIds = [...new Set(dailyRows.map((r) => r.card.sourceId))];

    const dailyItems =
      dailySourceIds.length > 0
        ? await this.prisma.dailyContentItem.findMany({
            select: {
              bodyMd: true,
              contentDate: true,
              explanationText: true,
              id: true,
              japaneseText: true
            },
            where: { id: { in: dailySourceIds } }
          })
        : [];

    const disclaimerJapaneseFronts = [
      ...new Set(
        dailyRows
          .filter((r) => isLikelyVietnameseLegalDisclaimerOnlyBack(r.card.backText))
          .map((r) => r.card.frontText)
      )
    ];

    if (disclaimerJapaneseFronts.length > 0) {
      const extra = await this.prisma.dailyContentItem.findMany({
        select: {
          bodyMd: true,
          contentDate: true,
          explanationText: true,
          id: true,
          japaneseText: true
        },
        where: { japaneseText: { in: disclaimerJapaneseFronts } }
      });
      const seen = new Set(dailyItems.map((i) => i.id));
      for (const it of extra) {
        if (!seen.has(it.id)) {
          seen.add(it.id);
          dailyItems.push(it);
        }
      }
    }

    const mergedSorted = [...dailyItems].sort(
      (a, b) => b.contentDate.getTime() - a.contentDate.getTime()
    );
    const dailyByIdFull = new Map(mergedSorted.map((it) => [it.id, it]));
    const dailyByJapanese = new Map<string, (typeof dailyItems)[number]>();
    for (const it of mergedSorted) {
      const key = it.japaneseText;
      if (key == null || key.length === 0) {
        continue;
      }
      const prev = dailyByJapanese.get(key);
      if (
        !prev ||
        (it.bodyMd?.length ?? 0) > (prev.bodyMd?.length ?? 0)
      ) {
        dailyByJapanese.set(key, it);
      }
    }

    const backFixes: Array<{ backText: string; cardId: string }> = [];
    const backByCardId = new Map<string, string>();
    for (const row of rows) {
      if (row.card.sourceType !== "daily_content") {
        continue;
      }
      let item = dailyByIdFull.get(row.card.sourceId);
      const fromJapanese = dailyByJapanese.get(row.card.frontText);
      if (isLikelyVietnameseLegalDisclaimerOnlyBack(row.card.backText) && fromJapanese) {
        if (
          !item ||
          (fromJapanese.bodyMd?.length ?? 0) > (item.bodyMd?.length ?? 0)
        ) {
          item = fromJapanese;
        }
      }
      const fixed = repairDailyContentFlashcardBackIfNeeded(
        row.card.backText,
        item?.bodyMd,
        item?.explanationText
      );
      if (fixed) {
        backByCardId.set(row.card.id, fixed);
        backFixes.push({ backText: fixed, cardId: row.card.id });
      }
    }
    if (backFixes.length > 0) {
      await this.prisma.$transaction(
        backFixes.map((u) =>
          this.prisma.flashcardVariant.update({
            data: { backText: u.backText },
            where: { id: u.cardId }
          })
        )
      );
    }

    // Batch fetch examples per sourceType to avoid N+1
    const lexemeSourceIds = [...new Set(rows.filter((r) => r.card.sourceType === "lexeme").map((r) => r.card.sourceId))];
    const grammarSourceIds = [...new Set(rows.filter((r) => r.card.sourceType === "grammar").map((r) => r.card.sourceId))];
    const kanjiSourceIds = [...new Set(rows.filter((r) => r.card.sourceType === "kanji").map((r) => r.card.sourceId))];

    type Example = { japaneseText: string; reading: string | null; translationVi: string | null };
    const examplesBySource = new Map<string, Example[]>();
    const exampleLimit = 2;

    await Promise.all([
      (async () => {
        if (lexemeSourceIds.length === 0) return;
        const senses = await this.prisma.lexemeSense.findMany({
          select: {
            lexemeId: true,
            exampleLinks: {
              include: { exampleSentence: true },
              orderBy: { createdAt: "asc" },
              take: exampleLimit
            }
          },
          where: { lexemeId: { in: lexemeSourceIds } }
        });
        for (const s of senses) {
          const arr = examplesBySource.get(s.lexemeId) ?? [];
          for (const link of s.exampleLinks) {
            const ex = link.exampleSentence;
            if (!ex || ex.status !== "active") continue;
            if (arr.length >= exampleLimit) break;
            arr.push({ japaneseText: ex.japaneseText, reading: ex.reading, translationVi: ex.translationVi });
          }
          if (arr.length > 0) examplesBySource.set(s.lexemeId, arr);
        }
      })(),
      (async () => {
        if (grammarSourceIds.length === 0) return;
        const details = await this.prisma.grammarPointDetail.findMany({
          select: {
            grammarPointId: true,
            exampleLinks: {
              include: { exampleSentence: true },
              orderBy: { createdAt: "asc" },
              take: exampleLimit
            }
          },
          where: { grammarPointId: { in: grammarSourceIds } }
        });
        for (const d of details) {
          const arr = examplesBySource.get(d.grammarPointId) ?? [];
          for (const link of d.exampleLinks) {
            const ex = link.exampleSentence;
            if (!ex || ex.status !== "active") continue;
            if (arr.length >= exampleLimit) break;
            arr.push({ japaneseText: ex.japaneseText, reading: ex.reading, translationVi: ex.translationVi });
          }
          if (arr.length > 0) examplesBySource.set(d.grammarPointId, arr);
        }
      })(),
      (async () => {
        if (kanjiSourceIds.length === 0) return;
        const kEx = await this.prisma.kanjiExample.findMany({
          orderBy: { position: "asc" },
          select: { kanjiId: true, meaningVi: true, reading: true, word: true },
          where: { kanjiId: { in: kanjiSourceIds } }
        });
        for (const e of kEx) {
          const arr = examplesBySource.get(e.kanjiId) ?? [];
          if (arr.length >= exampleLimit) continue;
          arr.push({ japaneseText: e.word, reading: e.reading, translationVi: e.meaningVi });
          examplesBySource.set(e.kanjiId, arr);
        }
      })()
    ]);

    return Promise.all(
      rows.map(async (row) => {
        const mediaLinks = row.card.mediaLinks;
        const imageLink =
          mediaLinks.find((m) => m.role === "primary_image") ??
          mediaLinks.find((m) => m.asset.mimeType.startsWith("image/")) ??
          null;
        const audioLink =
          mediaLinks.find((m) => m.role === "primary_audio") ??
          mediaLinks.find((m) => m.asset.mimeType.startsWith("audio/")) ??
          null;

        const resolveReadUrl = async (link: typeof imageLink) => {
          if (!link) return null;
          if (link.asset.provider === "external_url" && link.asset.sourceUrl?.trim()) {
            return link.asset.sourceUrl.trim();
          }
          return this.mediaService.presignedGetForObjectKey(link.asset.objectKey);
        };

        const [imageReadUrl, audioReadUrl] = await Promise.all([
          resolveReadUrl(imageLink),
          resolveReadUrl(audioLink)
        ]);

        const backText = backByCardId.get(row.card.id) ?? row.card.backText;
        const examples = examplesBySource.get(row.card.sourceId) ?? [];

        return {
          card: {
            backText,
            frontText: row.card.frontText,
            id: row.card.id,
            reading: row.card.reading
          },
          cardId: row.cardId,
          comebackMode: row.comebackMode ?? false,
          examples,
          id: row.id,
          leeched: row.leeched ?? false,
          primaryAudio: audioLink
            ? {
                assetId: audioLink.assetId,
                mimeType: audioLink.asset.mimeType,
                readUrl: audioReadUrl ?? null
              }
            : null,
          primaryImage: imageLink
            ? {
                assetId: imageLink.assetId,
                mimeType: imageLink.asset.mimeType,
                readUrl: imageReadUrl ?? null
              }
            : null,
          state: row.state
        };
      })
    );
  }

  async comebackSummaryForLearner(userId: string, days: number) {
    return this.flashcardsRepository.comebackSummary(userId, days);
  }

  /**
   * Single review: consumes quota then persists SRS state via `FlashcardsRepository.applySubmitReview`.
   */
  async submitReview(input: {
    elapsedMs?: number;
    rating: SrsRating;
    reviewedAt: Date;
    userFlashcardId: string;
    userId: string;
  }) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        await this.quotaService.consumeFlashcardReviewInTransaction(tx, input.userId);
        return this.flashcardsRepository.applySubmitReview(tx, input);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    // Fire-and-forget: update seasonal event progress
    this.seasonalEventService.updateProgress(input.userId, "reviews", 1).catch((e) =>
      this.logger.warn("Seasonal progress update failed", e instanceof Error ? e.message : e),
    );

    return result;
  }

  /**
   * Batch path: **one transaction per item** so a failure on card A does not roll back B; `clientMutationId`
   * lets the client reconcile partial success (offline sync).
   */
  async submitReviewBatch(input: {
    items: Array<{
      clientMutationId: string;
      elapsedMs?: number;
      rating: SrsRating;
      reviewedAt?: Date;
      userFlashcardId: string;
    }>;
    userId: string;
  }) {
    const results: Array<
      | { clientMutationId: string; ok: true }
      | { clientMutationId: string; error: string; ok: false }
    > = [];
    for (const item of input.items) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            await this.quotaService.consumeFlashcardReviewInTransaction(tx, input.userId);
            return this.flashcardsRepository.applySubmitReview(tx, {
              elapsedMs: item.elapsedMs,
              rating: item.rating,
              reviewedAt: item.reviewedAt ?? new Date(),
              userFlashcardId: item.userFlashcardId,
              userId: input.userId
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
        results.push({ clientMutationId: item.clientMutationId, ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "submit_failed";
        results.push({ clientMutationId: item.clientMutationId, error: message, ok: false });
      }
    }

    // Fire-and-forget: batch update seasonal event progress for all successful reviews
    const successCount = results.filter((r) => r.ok).length;
    if (successCount > 0) {
      this.seasonalEventService.updateProgress(input.userId, "reviews", successCount).catch((e) =>
        this.logger.warn("Seasonal progress update failed", e instanceof Error ? e.message : e),
      );
    }

    return { results };
  }
}
