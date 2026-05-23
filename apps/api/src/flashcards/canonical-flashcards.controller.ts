import {
  archiveOwnedDeckBodySchema,
  archiveOwnedDeckQuerySchema,
  createCardFromContentSchema,
  createDeckSchema,
  flashcardsDueQuerySchema,
  flashcardsUserScopedQuerySchema,
  submitReviewSchema
} from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";

import { SeasonalEventService } from "../gamification/seasonal-event.service.js";
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
  private readonly logger = new Logger(DecksController.name);

  constructor(
    @Inject(FlashcardsRepository) private readonly repo: FlashcardsRepository,
    @Inject(FlashcardsService) private readonly service: FlashcardsService,
    @Inject(SeasonalEventService) private readonly seasonalEventService: SeasonalEventService
  ) {}

  @Get()
  @ApiOperation({ summary: "Canonical v15 list learner decks." })
  @ApiQuery({ name: "limit", required: false, example: 20 })
  list(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Query() query: Record<string, string | undefined>) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = flashcardsUserScopedQuerySchema.safeParse({ ...query, userId });
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

  @Delete(":id")
  @ApiOperation({
    summary: "Archive learner-owned deck (same contract as DELETE /api/flashcards/decks/:deckId).",
    description:
      "Soft-removes the deck from the active library, unlinks cards, and prunes the caller's SRS rows per server policy."
  })
  @ApiParam({ name: "id" })
  archiveOwnedDeck(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") id: string,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = archiveOwnedDeckQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.archiveOwnedDeckForLearner(parsed.data.userId, id.trim());
  }

  @Post(":id/archive")
  @ApiOperation({
    summary: "Archive learner-owned deck via POST (alias when DELETE is blocked).",
    description: "Same as `DELETE /decks/:id?userId=`; JSON body `{ \"userId\" }`."
  })
  @ApiParam({ name: "id" })
  archiveOwnedDeckPost(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = archiveOwnedDeckBodySchema.safeParse({ ...raw, userId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.archiveOwnedDeckForLearner(parsed.data.userId, id.trim());
  }

  @Get(":deckId/cards")
  @ApiOperation({ summary: "Canonical v15 cards in deck." })
  @ApiParam({ name: "deckId" })
  cards(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Param("deckId") deckId: string, @Query() query: Record<string, string | undefined>) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = flashcardsUserScopedQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.deckCards(userId, deckId, parsed.data.limit);
  }

  @Post(":deckId/cards")
  @ApiOperation({ summary: "Canonical v15 add card from content to deck." })
  @ApiParam({ name: "deckId" })
  async addCard(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Param("deckId") deckId: string, @Body() body: unknown) {
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = createCardFromContentSchema.safeParse({ ...raw, deckId, userId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const result = await this.repo.createCardFromContent({ ...parsed.data, deckId });

    // Fire-and-forget: update seasonal event progress for new cards
    this.seasonalEventService.updateProgress(userId, "new_cards", 1).catch((e) =>
      this.logger.warn("Seasonal progress update failed", e instanceof Error ? e.message : e),
    );

    return result;
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
    const parsed = flashcardsDueQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.dueReviewsForLearner(parsed.data.userId, parsed.data.limit, parsed.data.deckId);
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
