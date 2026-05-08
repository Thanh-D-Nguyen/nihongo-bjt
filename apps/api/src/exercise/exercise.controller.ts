import {
  generateExercisesQuerySchema,
  startExerciseSessionSchema,
  submitExerciseAnswerSchema
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
import { ExerciseRepository } from "./exercise.repository.js";
import { ExerciseService } from "./exercise.service.js";

@Controller("exercises")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Exercises", "Study")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class ExerciseController {
  constructor(
    @Inject(ExerciseService) private readonly exerciseService: ExerciseService,
    @Inject(ExerciseRepository) private readonly repo: ExerciseRepository
  ) {}

  @Get("generate")
  @ApiOperation({
    summary: "Generate a batch of exercises from existing content.",
    description:
      "Returns freshly generated exercises based on type, level, and count. Exercises are created from dictionary, grammar, and example sentence data."
  })
  @ApiQuery({ name: "type", required: false, schema: { type: "string", enum: ["word_order", "cloze", "translation", "meaning_match", "listening"] } })
  @ApiQuery({ name: "level", required: false, schema: { type: "string", enum: ["N5", "N4", "N3", "N2", "N1"] } })
  @ApiQuery({ name: "count", required: false, schema: { type: "integer", default: 5 } })
  @ApiQuery({ name: "sourceType", required: false, schema: { type: "string", enum: ["lexeme", "grammar", "kanji"] } })
  @ApiQuery({ name: "placement", required: false, schema: { type: "string", enum: ["practice_tab", "post_review", "daily_hub"] } })
  async generate(@Query() query: Record<string, string | undefined>) {
    const parsed = generateExercisesQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.exerciseService.generateExercises({
      type: parsed.data.type,
      level: parsed.data.level,
      count: parsed.data.count,
      sourceType: parsed.data.sourceType,
      placement: parsed.data.placement
    });
  }

  @Get("config")
  @ApiOperation({ summary: "Get exercise configuration for a placement surface." })
  @ApiQuery({ name: "placement", required: false, schema: { type: "string" } })
  async config(@Query("placement") placement: string | undefined) {
    if (placement) {
      return this.repo.enabledConfigsForPlacement(placement);
    }
    return this.repo.listConfigs();
  }

  @Post("sessions")
  @ApiOperation({ summary: "Start a new exercise session (user-bound)." })
  async startSession(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown
  ) {
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, {
      required: true
    })!;

    const parsed = startExerciseSessionSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.exerciseService.startSession({
      userId: parsed.data.userId,
      sessionType: parsed.data.sessionType,
      exerciseType: parsed.data.exerciseType,
      level: parsed.data.level
    });
  }

  @Post("sessions/:id/answer")
  @ApiOperation({ summary: "Submit an answer for an exercise within a session." })
  @ApiParam({ name: "id", description: "Session ID" })
  async submitAnswer(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") sessionId: string,
    @Body() body: unknown
  ) {
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, {
      required: true
    })!;

    const parsed = submitExerciseAnswerSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.exerciseService.submitAnswer({
      sessionId,
      exerciseId: parsed.data.exerciseId,
      userAnswer: parsed.data.userAnswer,
      timeSpentMs: parsed.data.timeSpentMs,
      userId: parsed.data.userId
    });
  }

  @Post("sessions/:id/complete")
  @ApiOperation({ summary: "Complete an exercise session, calculating final scores." })
  @ApiParam({ name: "id", description: "Session ID" })
  async completeSession(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") sessionId: string,
    @Query("userId") userId: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    return this.exerciseService.completeSession(sessionId, resolved);
  }

  @Get("sessions/history")
  @ApiOperation({ summary: "Get the user's exercise session history." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 20 } })
  async sessionHistory(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("userId") userId: string | undefined,
    @Query("limit") limitStr: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    const limit = Math.min(Math.max(parseInt(limitStr ?? "20", 10) || 20, 1), 100);
    return this.repo.userSessionHistory(resolved, limit);
  }
}
