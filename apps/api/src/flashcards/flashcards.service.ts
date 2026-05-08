import { createPrismaClient, Prisma } from "@nihongo-bjt/database";
import {
  isLikelyVietnameseLegalDisclaimerOnlyBack,
  repairDailyContentFlashcardBackIfNeeded,
  type SrsRating
} from "@nihongo-bjt/shared";
import { Inject, Injectable } from "@nestjs/common";

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

  constructor(
    @Inject(FlashcardsRepository) private readonly flashcardsRepository: FlashcardsRepository,
    @Inject(MediaService) private readonly mediaService: MediaService,
    @Inject(QuotaService) private readonly quotaService: QuotaService
  ) {}

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
    return Promise.all(
      rows.map(async (row) => {
        const mediaLinks = row.card.mediaLinks;
        const primary = mediaLinks.find((m) => m.role === "primary_image") ?? mediaLinks[0] ?? null;
        const readUrl =
          primary?.asset.provider === "external_url" && primary.asset.sourceUrl?.trim()
            ? primary.asset.sourceUrl.trim()
            : primary?.asset
              ? await this.mediaService.presignedGetForObjectKey(primary.asset.objectKey)
              : null;
        const backText = backByCardId.get(row.card.id) ?? row.card.backText;
        return {
          card: {
            backText,
            frontText: row.card.frontText,
            id: row.card.id,
            reading: row.card.reading
          },
          cardId: row.cardId,
          comebackMode: row.comebackMode ?? false,
          id: row.id,
          leeched: row.leeched ?? false,
          primaryImage: primary
            ? {
                assetId: primary.assetId,
                mimeType: primary.asset.mimeType,
                readUrl: readUrl ?? null
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
    return this.prisma.$transaction(
      async (tx) => {
        await this.quotaService.consumeFlashcardReviewInTransaction(tx, input.userId);
        return this.flashcardsRepository.applySubmitReview(tx, input);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
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
    return { results };
  }
}
