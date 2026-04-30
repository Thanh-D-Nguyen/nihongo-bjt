import {
  readingAssistAddCardSchema,
  readingAssistAnalyticsSchema,
  readingAssistAnalyzeSchema,
  readingAssistPreferenceQuerySchema,
  readingAssistPreferenceUpdateSchema,
  readingAssistReportSchema
} from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Put,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { RuntimeFeatureGateService } from "../operations/runtime-feature-gate.service.js";
import { ReadingAssistService } from "./reading-assist.service.js";

/**
 * Learner reading assist API. Client-provided exam hints are advisory only; timed exam enforcement
 * is resolved from authoritative backend quiz session state.
 */
@Controller("reading-assist")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Reading Assist", "Study")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class ReadingAssistController {
  constructor(
    @Inject(ReadingAssistService) private readonly readingAssist: ReadingAssistService,
    @Inject(RuntimeFeatureGateService) private readonly featureGate: RuntimeFeatureGateService
  ) {}

  @Post("analyze")
  @ApiOperation({
    summary: "Tokenize + dictionary lookup; timed exam gloss suppression is enforced server-side.",
    description: "Cached by text hash; does not log full private text to analytics payload."
  })
  async analyze(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown
  ) {
    await this.featureGate.requireEnabled("reading_assist", {
      message: "Reading assist is temporarily disabled"
    });
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = readingAssistAnalyzeSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const { examContext, quizSessionId, text, userId: uid } = parsed.data;
    return this.readingAssist.analyze({ examContext, quizSessionId, text, userId: uid });
  }

  @Get("preferences")
  @ApiOperation({ summary: "Reading assist display preferences (furigana mode, etc.)." })
  async preferences(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    await this.featureGate.requireEnabled("reading_assist", {
      message: "Reading assist is temporarily disabled"
    });
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = readingAssistPreferenceQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.readingAssist.getPreference(parsed.data.userId);
  }

  @Put("preferences")
  @ApiOperation({ summary: "Update reading assist preferences." })
  async putPreferences(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown
  ) {
    await this.featureGate.requireEnabled("reading_assist", {
      message: "Reading assist is temporarily disabled"
    });
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = readingAssistPreferenceUpdateSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.readingAssist.updatePreference(parsed.data);
  }

  @Post("flashcard")
  @ApiOperation({ summary: "Create flashcard from analyzed token selection." })
  async addCard(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Body() body: unknown) {
    await this.featureGate.requireEnabled("reading_assist", {
      message: "Reading assist is temporarily disabled"
    });
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = readingAssistAddCardSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.readingAssist.addCardFromReading(parsed.data);
  }

  @Post("report")
  @ApiOperation({ summary: "Report tokenization/dictionary gap (admin triage)." })
  async report(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Body() body: unknown) {
    await this.featureGate.requireEnabled("reading_assist", {
      message: "Reading assist is temporarily disabled"
    });
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: false });
    const parsed = readingAssistReportSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.readingAssist.reportIssue(parsed.data);
  }

  @Post("analytics")
  @ApiOperation({
    summary: "Low-PII assist analytics (hashes/indices only; no raw sentence in stored payload).",
    description: "See `inferAnalytics` implementation for field allowlist."
  })
  async analyticsEvent(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown
  ) {
    await this.featureGate.requireEnabled("reading_assist", {
      message: "Reading assist is temporarily disabled"
    });
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: false });
    const parsed = readingAssistAnalyticsSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const { anonymousId, deckId, displayMode, eventName, sessionId, textHash, tokenIndex, userId: uid } =
      parsed.data;
    const safePayload: Record<string, unknown> = {};
    if (textHash) {
      safePayload.textHash = textHash;
    }
    if (tokenIndex !== undefined) {
      safePayload.tokenIndex = tokenIndex;
    }
    if (deckId) {
      safePayload.deckId = deckId;
    }
    if (displayMode) {
      safePayload.displayMode = displayMode;
    }
    return this.readingAssist.inferAnalytics({
      anonymousId,
      eventName,
      params: safePayload,
      sessionId,
      userId: uid
    });
  }
}
