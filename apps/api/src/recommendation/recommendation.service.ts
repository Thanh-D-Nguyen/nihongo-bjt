import { Inject, Injectable, Logger } from "@nestjs/common";
import { createPrismaClient } from "@nihongo-bjt/database";

import { FlashcardReviewPipeline } from "./flashcard-review.pipeline.js";
import { NewsFeedPipeline } from "./news-feed.pipeline.js";
import type { Candidate, PipelineResult } from "./pipeline/types.js";
import { StudyFeedPipeline } from "./study-feed.pipeline.js";
import { UserContextHydrator } from "./user-context.hydrator.js";

export interface FeedRequest {
  userId: string;
  limit?: number;
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);
  private readonly prisma = createPrismaClient();

  constructor(
    @Inject(UserContextHydrator) private readonly ctxHydrator: UserContextHydrator,
    @Inject(StudyFeedPipeline) private readonly studyFeed: StudyFeedPipeline,
    @Inject(NewsFeedPipeline) private readonly newsFeed: NewsFeedPipeline,
    @Inject(FlashcardReviewPipeline) private readonly flashcardReview: FlashcardReviewPipeline,
  ) {}

  /** "For You" study feed — mixed content recommendations */
  async getStudyFeed(req: FeedRequest): Promise<PipelineResult> {
    const ctx = await this.ctxHydrator.hydrate(req.userId);
    const result = await this.studyFeed.execute(ctx, req.limit ?? 15);
    void this.trackServedItems(req.userId, result.candidates, "study-feed");
    return result;
  }

  /** Ranked news articles personalized to learner */
  async getNewsFeed(req: FeedRequest): Promise<PipelineResult> {
    const ctx = await this.ctxHydrator.hydrate(req.userId);
    const result = await this.newsFeed.execute(ctx, req.limit ?? 10);
    void this.trackServedItems(req.userId, result.candidates, "news-feed");
    return result;
  }

  /** Adaptive flashcard review ordering */
  async getReviewQueue(req: FeedRequest): Promise<PipelineResult> {
    const ctx = await this.ctxHydrator.hydrate(req.userId);
    const result = await this.flashcardReview.execute(ctx, req.limit ?? 20);
    void this.trackServedItems(req.userId, result.candidates, "review-queue");
    return result;
  }

  /** Fire-and-forget: record served items for dedup in next request */
  private async trackServedItems(userId: string, candidates: Candidate[], pipeline: string): Promise<void> {
    if (candidates.length === 0) return;
    try {
      const values = candidates
        .map((_, i) => `($1::uuid, $${i * 2 + 2}, $${i * 2 + 3}, $${candidates.length * 2 + 2})`)
        .join(", ");
      const params: (string | number)[] = [userId];
      for (const c of candidates) {
        params.push(c.id, c.type);
      }
      params.push(pipeline);

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO recommendation.served_item (user_id, item_id, item_type, pipeline)
         VALUES ${values}`,
        ...params,
      );
    } catch (err) {
      // Non-critical — log and move on
      this.logger.debug(`Failed to track served items: ${err instanceof Error ? err.message : err}`);
    }
  }
}
