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
  async generate(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const parsed = generateExercisesQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const userId = user?.sub;
    return this.exerciseService.generateExercises({
      type: parsed.data.type,
      level: parsed.data.level,
      count: parsed.data.count,
      sourceType: parsed.data.sourceType,
      placement: parsed.data.placement,
      userId
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

  @Get("performance")
  @ApiOperation({
    summary: "Get user's adaptive performance data per exercise type.",
    description: "Returns the user's running accuracy, current difficulty level, and performance stats for each exercise type and level combination."
  })
  @ApiQuery({ name: "exerciseType", required: false, schema: { type: "string" } })
  async getPerformance(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("userId") userId: string | undefined,
    @Query("exerciseType") exerciseType: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    if (exerciseType) {
      return this.repo.getUserPerformanceByType(resolved, exerciseType);
    }
    // Return all performance records for this user
    return this.repo.getAllUserPerformance(resolved);
  }

  @Get("remediations")
  @ApiOperation({
    summary: "Get remediation flashcards created from failed exercises.",
    description: "Returns recent auto-generated flashcards that were created when the user answered incorrectly."
  })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 20 } })
  async getRemediations(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("userId") userId: string | undefined,
    @Query("limit") limitStr: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    const limit = Math.min(Math.max(parseInt(limitStr ?? "20", 10) || 20, 1), 50);
    return this.repo.getUserRemediations(resolved, limit);
  }

  @Get("daily-progress")
  @ApiOperation({
    summary: "Get today's exercise progress vs daily goal.",
    description: "Returns the count of exercises completed today and the daily goal target."
  })
  async getDailyProgress(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("userId") userId: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    const [completed, goal] = await Promise.all([
      this.repo.countTodayExercises(resolved),
      this.repo.getDailyGoalExercises(resolved)
    ]);
    return {
      completed,
      goal,
      progress: goal > 0 ? Math.min(completed / goal, 1.0) : 1.0,
      isComplete: completed >= goal
    };
  }

  @Post("remediate/:exerciseId")
  @ApiOperation({
    summary: "Manually create a remediation flashcard from an exercise.",
    description: "Creates a flashcard from a specific exercise and adds it to the user's SRS queue."
  })
  @ApiParam({ name: "exerciseId", description: "Exercise ID to create flashcard from" })
  async manualRemediate(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("exerciseId") exerciseId: string,
    @Query("userId") userId: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    return this.exerciseService.manualRemediate(resolved, exerciseId);
  }

  @Get("review/due")
  @ApiOperation({
    summary: "Get exercises due for SRS review.",
    description: "Returns exercises that are scheduled for review based on the SM-2 spaced repetition algorithm."
  })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 20 } })
  async getDueReviews(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("userId") userId: string | undefined,
    @Query("limit") limitStr: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    const limit = Math.min(Math.max(parseInt(limitStr ?? "20", 10) || 20, 1), 50);
    return this.exerciseService.getDueReviews(resolved, limit);
  }

  @Post("review/:exerciseId")
  @ApiOperation({
    summary: "Submit a review rating for an exercise (SRS).",
    description: "Rates how well the user recalled an exercise. Updates the SRS scheduling. Ratings: again, hard, good, easy."
  })
  @ApiParam({ name: "exerciseId", description: "Exercise ID being reviewed" })
  async reviewExercise(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("exerciseId") exerciseId: string,
    @Body() body: { rating: string; userId?: string }
  ) {
    const resolved = resolveLearnerUserId(user, body.userId, { required: true })!;
    const validRatings = ["again", "hard", "good", "easy"];
    if (!validRatings.includes(body.rating)) {
      throw new BadRequestException(`Rating must be one of: ${validRatings.join(", ")}`);
    }
    return this.exerciseService.reviewExercise(
      resolved,
      exerciseId,
      body.rating as "again" | "hard" | "good" | "easy"
    );
  }
}
