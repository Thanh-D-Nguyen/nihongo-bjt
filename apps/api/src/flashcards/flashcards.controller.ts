import {
  createCardFromContentSchema,
  comebackSummaryQuerySchema,
  createDeckSchema,
  linkCardMediaSchema,
  reviewBatchSchema,
  submitReviewSchema,
  userScopedQuerySchema
} from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { FlashcardsRepository } from "./flashcards.repository.js";
import { FlashcardsService } from "./flashcards.service.js";

@Controller("flashcards")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Flashcards", "SRS")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class FlashcardsController {
  constructor(
    @Inject(FlashcardsRepository) private readonly flashcardsRepository: FlashcardsRepository,
    @Inject(FlashcardsService) private readonly flashcardsService: FlashcardsService
  ) {}

  @Get("decks")
  @ApiOperation({ summary: "List user decks (paginated by `userScopedQuerySchema`)." })
  decks(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = userScopedQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.flashcardsRepository.decks(parsed.data.userId, parsed.data.limit);
  }

  @Post("decks")
  @ApiOperation({ summary: "Create deck from JSON body (Zod `createDeckSchema`)." })
  createDeck(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Body() body: unknown) {
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = createDeckSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.flashcardsRepository.createDeck(parsed.data);
  }

  @Post("cards/from-content")
  @ApiOperation({ summary: "Create card from dictionary/content id." })
  createCardFromContent(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown
  ) {
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = createCardFromContentSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.flashcardsRepository.createCardFromContent(parsed.data);
  }

  @Get("reviews/due")
  @ApiOperation({ summary: "Due user flashcards for SRS (ordered by `dueAt`)." })
  dueReviews(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = userScopedQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.flashcardsService.dueReviewsForLearner(parsed.data.userId, parsed.data.limit);
  }

  @Get("reviews/comeback-summary")
  @ApiOperation({
    summary: "Persisted comeback progress evidence for learner (active/due/leeched + recent comeback reviews)."
  })
  comebackSummary(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = comebackSummaryQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.flashcardsService.comebackSummaryForLearner(parsed.data.userId, parsed.data.days);
  }

  @Post("cards/:cardId/media")
  @ApiOperation({ summary: "Attach uploaded media to a user card." })
  @ApiParam({ name: "cardId" })
  linkCardMedia(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("cardId") cardId: string,
    @Body() body: unknown
  ) {
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = linkCardMediaSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.flashcardsRepository.linkCardToMedia({ ...parsed.data, cardId });
  }

  @Post("reviews/batch")
  @ApiOperation({
    summary: "Submit many SRS reviews; **per-item transaction**; returns per-`clientMutationId` result (403 if quota).",
    description: "Ratings: again | hard | good | easy."
  })
  submitReviewBatch(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown
  ) {
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = reviewBatchSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.flashcardsService.submitReviewBatch({
      items: parsed.data.items.map((item) => ({
        clientMutationId: item.clientMutationId,
        elapsedMs: item.elapsedMs,
        rating: item.rating,
        reviewedAt: item.reviewedAt ? new Date(item.reviewedAt) : undefined,
        userFlashcardId: item.userFlashcardId
      })),
      userId: parsed.data.userId
    });
  }

  @Post("reviews/:userFlashcardId")
  @ApiOperation({ summary: "Single SRS review (quota + transaction with `userFlashcard` update + `reviewEvent`)." })
  @ApiParam({ name: "userFlashcardId" })
  submitReview(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("userFlashcardId") userFlashcardId: string,
    @Body() body: unknown
  ) {
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = submitReviewSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.flashcardsService.submitReview({
      ...parsed.data,
      reviewedAt: parsed.data.reviewedAt ? new Date(parsed.data.reviewedAt) : new Date(),
      userFlashcardId
    });
  }
}
