import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { RecommendationService } from "./recommendation.service.js";

@Controller("recommendation")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Recommendation")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class RecommendationController {
  constructor(
    @Inject(RecommendationService) private readonly service: RecommendationService,
  ) {}

  @Get("study-feed")
  @ApiOperation({
    summary: "Get personalized study feed (For You)",
    description:
      "Returns a ranked list of study items (flashcards, exercises, lessons) " +
      "personalized using engagement history, weak areas, and level. " +
      "Inspired by X recommendation algorithm: multi-source retrieval → scoring → diversity.",
  })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Max items (default 15)" })
  async getStudyFeed(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("limit") limitStr?: string,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const limit = Math.min(Math.max(parseInt(limitStr ?? "15", 10) || 15, 5), 50);
    const result = await this.service.getStudyFeed({ userId, limit });
    return {
      items: result.candidates.map((c) => ({
        id: c.id,
        type: c.type,
        title: (c.data as { title?: string }).title,
        score: Math.round(c.score * 1000) / 1000,
        source: c.source,
      })),
      meta: result.meta,
    };
  }

  @Get("news-feed")
  @ApiOperation({
    summary: "Get ranked news articles",
    description:
      "Returns NHK/news articles ranked by level match, recency, topic interest, and trending signals.",
  })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Max items (default 10)" })
  async getNewsFeed(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("limit") limitStr?: string,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const limit = Math.min(Math.max(parseInt(limitStr ?? "10", 10) || 10, 5), 30);
    const result = await this.service.getNewsFeed({ userId, limit });
    return {
      items: result.candidates.map((c) => ({
        id: c.id,
        type: c.type,
        title: (c.data as { title?: string }).title,
        summary: (c.data as { summary?: string }).summary,
        category: (c.data as { category?: string }).category,
        score: Math.round(c.score * 1000) / 1000,
        source: c.source,
      })),
      meta: result.meta,
    };
  }

  @Get("review-queue")
  @ApiOperation({
    summary: "Get adaptive flashcard review queue",
    description:
      "Returns flashcards ordered by predicted recall probability, urgency, " +
      "and learning value. Interleaves overdue/new/leeched cards for optimal retention.",
  })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Max items (default 20)" })
  async getReviewQueue(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("limit") limitStr?: string,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const limit = Math.min(Math.max(parseInt(limitStr ?? "20", 10) || 20, 5), 100);
    const result = await this.service.getReviewQueue({ userId, limit });
    return {
      items: result.candidates.map((c) => ({
        id: c.id,
        cardId: (c.data as { cardId?: string }).cardId,
        deckName: (c.data as { deckName?: string }).deckName,
        state: (c.data as { state?: string }).state,
        predictedRecall: c.features["p_recall"],
        score: Math.round(c.score * 1000) / 1000,
        source: c.source,
      })),
      meta: result.meta,
    };
  }
}
