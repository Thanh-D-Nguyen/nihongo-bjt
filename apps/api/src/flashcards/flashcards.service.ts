import { createPrismaClient, Prisma } from "@nihongo-bjt/database";
import { type SrsRating } from "@nihongo-bjt/shared";
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

  async dueReviewsForLearner(userId: string, limit: number) {
    const rows = await this.flashcardsRepository.dueReviews(userId, limit);
    return Promise.all(
      rows.map(async (row) => {
        const mediaLinks = row.card.mediaLinks;
        const primary = mediaLinks.find((m) => m.role === "primary_image") ?? mediaLinks[0] ?? null;
        const readUrl = primary?.asset
          ? await this.mediaService.presignedGetForObjectKey(primary.asset.objectKey)
          : null;
        return {
          card: {
            backText: row.card.backText,
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
