import {
  createCardFromContentSchema,
  createDeckSchema,
  submitReviewSchema,
  userScopedQuerySchema
} from "@nihongo-bjt/shared";
import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import {
  DueFlashcardOpenApiDto,
  ReviewSubmitOutcomeOpenApiDto,
  SubmitReviewRequestOpenApiDto
} from "../openapi/dto/backend-api-openapi.dto.js";
import { FlashcardsRepository } from "./flashcards.repository.js";
import { FlashcardsService } from "./flashcards.service.js";

@Controller("decks")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Flashcards")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class DecksController {
  constructor(
    @Inject(FlashcardsRepository) private readonly repo: FlashcardsRepository,
    @Inject(FlashcardsService) private readonly service: FlashcardsService
  ) {}

  @Get()
  @ApiOperation({ summary: "Canonical v15 list learner decks." })
  @ApiQuery({ name: "limit", required: false, example: 20 })
  list(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Query() query: Record<string, string | undefined>) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = userScopedQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.decks(parsed.data.userId, parsed.data.limit);
  }

  @Post()
  @ApiOperation({ summary: "Canonical v15 create learner deck." })
  create(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Body() body: unknown) {
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = createDeckSchema.safeParse({ ...raw, userId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.createDeck(parsed.data);
  }

  @Get(":id")
  @ApiOperation({ summary: "Canonical v15 deck detail." })
  @ApiParam({ name: "id" })
  detail(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Param("id") id: string, @Query() query: Record<string, string | undefined>) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    return this.repo.deckDetail(userId, id);
  }

  @Get(":deckId/cards")
  @ApiOperation({ summary: "Canonical v15 cards in deck." })
  @ApiParam({ name: "deckId" })
  cards(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Param("deckId") deckId: string, @Query() query: Record<string, string | undefined>) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = userScopedQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.deckCards(userId, deckId, parsed.data.limit);
  }

  @Post(":deckId/cards")
  @ApiOperation({ summary: "Canonical v15 add card from content to deck." })
  @ApiParam({ name: "deckId" })
  addCard(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Param("deckId") deckId: string, @Body() body: unknown) {
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = createCardFromContentSchema.safeParse({ ...raw, deckId, userId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.createCardFromContent(parsed.data);
  }
}

@Controller("review")
@UseGuards(KeycloakAuthGuard)
@ApiTags("SRS")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class ReviewController {
  constructor(
    @Inject(FlashcardsRepository) private readonly repo: FlashcardsRepository,
    @Inject(FlashcardsService) private readonly service: FlashcardsService
  ) {}

  @Get("next")
  @ApiOperation({ summary: "Canonical v15 due SRS queue." })
  @ApiOkResponse({ type: DueFlashcardOpenApiDto, isArray: true })
  next(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Query() query: Record<string, string | undefined>) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = userScopedQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.dueReviewsForLearner(parsed.data.userId, parsed.data.limit);
  }

  @Post()
  @ApiOperation({ summary: "Canonical v15 submit one SRS review." })
  @ApiBody({ type: SubmitReviewRequestOpenApiDto })
  @ApiOkResponse({ type: ReviewSubmitOutcomeOpenApiDto })
  submit(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Body() body: unknown) {
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = submitReviewSchema
      .extend({ userFlashcardId: submitReviewSchema.shape.userId })
      .safeParse({ ...raw, userId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.submitReview({
      elapsedMs: parsed.data.elapsedMs,
      rating: parsed.data.rating,
      reviewedAt: parsed.data.reviewedAt ? new Date(parsed.data.reviewedAt) : new Date(),
      userFlashcardId: parsed.data.userFlashcardId,
      userId: parsed.data.userId
    });
  }

  @Get("summary")
  @ApiOperation({ summary: "Canonical v15 daily SRS review summary." })
  summary(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Query() query: Record<string, string | undefined>) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    return this.repo.reviewSummary(userId);
  }
}
