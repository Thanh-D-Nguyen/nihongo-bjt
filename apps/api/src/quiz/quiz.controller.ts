import { startQuizSchema, submitQuizAnswerSchema } from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { PublicRoute } from "../keycloak/keycloak-public.decorator.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { BjtQuestionQualityIssueOpenApiDto, QuizSessionBreakdownOpenApiDto, QuizSessionRemediationItemOpenApiDto } from "../openapi/dto/backend-api-openapi.dto.js";
import { QuizRepository } from "./quiz.repository.js";
import { QuizService } from "./quiz.service.js";

@Controller("quiz")
@UseGuards(KeycloakAuthGuard)
@ApiTags("BJT Questions", "Study")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class QuizController {
  constructor(
    @Inject(QuizRepository) private readonly quizRepository: QuizRepository,
    private readonly quizService: QuizService
  ) {}

  @Get("templates")
  @PublicRoute()
  @ApiOperation({ summary: "List quiz/BJT test templates (public; no PII)." })
  templates() {
    return this.quizRepository.templates();
  }

  @Get("templates/:id")
  @PublicRoute()
  @ApiOperation({ summary: "Single template with sections/questions metadata." })
  @ApiParam({ name: "id" })
  template(@Param("id") id: string) {
    return this.quizRepository.template(id);
  }

  @Post("start")
  @ApiOperation({ summary: "Start a scored session for a `testId` (user-bound)." })
  start(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Body() body: unknown) {
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = startQuizSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.quizService.startSessionWithQuota(parsed.data.testId, parsed.data.userId);
  }

  @Get("session/:id/question")
  @ApiOperation({ summary: "Current question for active session (timing rules in repository)." })
  @ApiParam({ name: "id", description: "Session id" })
  currentQuestion(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") id: string,
    @Query("userId") userId: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    return this.quizRepository.currentQuestion(id, resolved);
  }

  @Post("session/:id/answer")
  @ApiOperation({ summary: "Submit answer; scoring + analytics in repository." })
  @ApiParam({ name: "id" })
  answer(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = submitQuizAnswerSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.quizRepository.submitAnswer({
      optionKey: parsed.data.optionKey,
      questionId: parsed.data.questionId,
      sessionId: id,
      userId: parsed.data.userId
    });
  }

  @Get("session/:id/remediation")
  @ApiOperation({ summary: "List wrong-answer remediation flashcards for a completed quiz session." })
  @ApiOkResponse({ type: QuizSessionRemediationItemOpenApiDto, isArray: true })
  @ApiParam({ name: "id" })
  remediation(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") id: string,
    @Query("userId") userId: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    return this.quizRepository.remediation(id, resolved);
  }

  @Get("session/:id/results")
  @ApiOperation({ summary: "Session results summary (no answer key leakage rules in service)." })
  @ApiParam({ name: "id" })
  results(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") id: string,
    @Query("userId") userId: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    return this.quizRepository.results(id, resolved);
  }

  @Get("session/:id/results/breakdown")
  @ApiOperation({ summary: "Detailed per-question breakdown with explanations for completed session." })
  @ApiOkResponse({ type: QuizSessionBreakdownOpenApiDto })
  @ApiParam({ name: "id" })
  breakdown(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") id: string,
    @Query("userId") userId: string | undefined
  ) {
    const resolved = resolveLearnerUserId(user, userId, { required: true })!;
    return this.quizRepository.breakdown(id, resolved);
  }

  @Get("admin/items/quality")
  @ApiOperation({ summary: "Admin: List quiz questions with validation/quality issues." })
  @ApiOkResponse({ type: BjtQuestionQualityIssueOpenApiDto, isArray: true })
  admin_listQualityIssues(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    if (!user) {
      throw new ForbiddenException("Admin access required");
    }

    const isAdmin = user.realmRoles?.includes("admin");
    if (!isAdmin) {
      throw new ForbiddenException("Admin access required");
    }

    return this.quizRepository.listQualityIssues();
  }
}
