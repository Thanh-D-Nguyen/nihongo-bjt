import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import {
  AVAILABLE_TOPICS,
  OnboardingRepository,
  type SaveOnboardingInput,
} from "./onboarding.repository.js";

const VALID_GOALS = [
  "pass_bjt",
  "business_japanese",
  "daily_conversation",
  "reading_news",
  "jlpt_prep",
  "travel",
  "general",
] as const;

const VALID_STYLES = ["visual", "practice", "immersion", "flashcard", "mixed"] as const;

@Controller("recommendation/onboarding")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Recommendation")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class OnboardingController {
  constructor(
    @Inject(OnboardingRepository) private readonly repo: OnboardingRepository,
  ) {}

  @Get("preferences")
  @ApiOperation({ summary: "Get user onboarding preferences" })
  async getPreferences(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const prefs = await this.repo.getPreferences(userId);
    return { preferences: prefs, availableTopics: AVAILABLE_TOPICS };
  }

  @Get("status")
  @ApiOperation({ summary: "Check if user has completed onboarding" })
  async getStatus(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const completed = await this.repo.hasCompletedOnboarding(userId);
    return { completed };
  }

  @Post("preferences")
  @ApiOperation({
    summary: "Save onboarding preferences",
    description: "Called after user completes the initial preference questionnaire. Used to bootstrap recommendations.",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        currentLevel: { type: "number", minimum: 0, maximum: 5, description: "0=unsure, 1=N1, 5=N5" },
        goal: { type: "string", enum: [...VALID_GOALS] },
        topics: { type: "array", items: { type: "string" }, maxItems: 5 },
        dailyMinutes: { type: "number", minimum: 5, maximum: 120 },
        style: { type: "string", enum: [...VALID_STYLES] },
      },
      required: ["currentLevel", "goal", "topics", "dailyMinutes", "style"],
    },
  })
  async savePreferences(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;

    // Validate
    const currentLevel = Number(body.currentLevel);
    if (isNaN(currentLevel) || currentLevel < 0 || currentLevel > 5) {
      throw new BadRequestException("currentLevel must be 0-5");
    }

    const goal = String(body.goal);
    if (!VALID_GOALS.includes(goal as (typeof VALID_GOALS)[number])) {
      throw new BadRequestException(`goal must be one of: ${VALID_GOALS.join(", ")}`);
    }

    const style = String(body.style);
    if (!VALID_STYLES.includes(style as (typeof VALID_STYLES)[number])) {
      throw new BadRequestException(`style must be one of: ${VALID_STYLES.join(", ")}`);
    }

    const topics = Array.isArray(body.topics) ? body.topics.map(String).slice(0, 5) : [];
    const dailyMinutes = Math.min(Math.max(Number(body.dailyMinutes) || 10, 5), 120);

    const input: SaveOnboardingInput = {
      currentLevel,
      goal: goal as SaveOnboardingInput["goal"],
      topics,
      dailyMinutes,
      style: style as SaveOnboardingInput["style"],
    };

    const prefs = await this.repo.savePreferences(userId, input);
    return { preferences: prefs };
  }
}
