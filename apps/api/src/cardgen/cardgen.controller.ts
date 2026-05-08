import {
  generateFlashcardDeckSchema,
  previewFlashcardGenSchema
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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags
} from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { CardgenService } from "./cardgen.service.js";

@Controller("cardgen")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Flashcard Generation")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class CardgenController {
  constructor(
    @Inject(CardgenService) private readonly svc: CardgenService
  ) {}

  @Post("generate")
  @ApiOperation({
    summary: "Generate a flashcard deck from content.",
    description:
      "Creates a new deck populated with auto-generated flashcards based on mode (by_level, by_topic, by_weak_area, daily_auto), source type, level, direction, and count."
  })
  async generateDeck(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown
  ) {
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, {
      required: true
    })!;

    const parsed = generateFlashcardDeckSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.svc.generateDeck({
      userId: parsed.data.userId,
      mode: parsed.data.mode,
      sourceType: parsed.data.sourceType,
      level: parsed.data.level,
      tags: parsed.data.tags,
      direction: parsed.data.direction,
      count: parsed.data.count
    });
  }

  @Post("preview")
  @ApiOperation({
    summary: "Preview flashcard generation (dry run).",
    description:
      "Returns estimated card count and sample cards without creating a deck."
  })
  async previewGeneration(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown
  ) {
    const parsed = previewFlashcardGenSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const userId = user?.appUserId;

    return this.svc.previewGeneration({
      mode: parsed.data.mode,
      sourceType: parsed.data.sourceType,
      level: parsed.data.level,
      tags: parsed.data.tags,
      direction: parsed.data.direction,
      count: parsed.data.count,
      userId
    });
  }

  @Get("jobs")
  @ApiOperation({ summary: "List the user's flashcard generation job history." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 20 } })
  async listJobs(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("userId") userId: string | undefined,
    @Query("limit") limitStr: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    const limit = Math.min(Math.max(parseInt(limitStr ?? "20", 10) || 20, 1), 100);
    return this.svc.getUserJobs(resolved, limit);
  }

  @Get("jobs/:id")
  @ApiOperation({ summary: "Get a specific flashcard generation job." })
  @ApiParam({ name: "id", description: "Job ID" })
  async getJob(@Param("id") id: string) {
    return this.svc.getJob(id);
  }
}
