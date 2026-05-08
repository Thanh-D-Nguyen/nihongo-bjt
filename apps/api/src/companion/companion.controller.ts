import { companionEventKindSchema, companionHintQuerySchema } from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { CompanionHintService } from "./companion-hint.service.js";
import { CompanionTipService } from "./companion-tip.service.js";

@Controller("companion")
@ApiTags("Companion")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class CompanionController {
  constructor(
    @Inject(CompanionHintService) private readonly companionHint: CompanionHintService,
    @Inject(CompanionTipService) private readonly companionTip: CompanionTipService
  ) {}

  @Get("hint")
  @UseGuards(KeycloakAuthGuard)
  @ApiOperation({
    summary: "Next-step study hint for the learner shell (deterministic ranker over real signals)."
  })
  @ApiQuery({ name: "days", required: false, description: "Analytics window 1–90, default 7" })
  @ApiQuery({ name: "userId", required: false, description: "Profile id (dev override if allowed)" })
  hint(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true });
    if (userId === undefined) {
      throw new BadRequestException("userId_required");
    }
    const parsed = companionHintQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.companionHint.hintForLearner(userId, parsed.data.days);
  }

  @Get("tip")
  @ApiOperation({ summary: "Random Japanese mini-tip for the companion bot." })
  @ApiQuery({ name: "category", required: false, description: "grammar, vocab, keigo, culture, business" })
  tip(@Query("category") category?: string) {
    return this.companionTip.getRandomTip(category);
  }

  @Get("tip/categories")
  @ApiOperation({ summary: "List available tip categories." })
  tipCategories() {
    return this.companionTip.getCategories();
  }

  @Post("event")
  @UseGuards(KeycloakAuthGuard)
  @ApiOperation({ summary: "Log a companion interaction event (for analytics)." })
  @ApiBody({ schema: { type: "object", properties: { kind: { type: "string" }, params: { type: "object" } } } })
  logEvent(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: { kind?: string; params?: Record<string, unknown> }
  ) {
    const parsed = companionEventKindSchema.safeParse(body.kind);
    if (!parsed.success) {
      throw new BadRequestException("invalid_event_kind");
    }
    // For now, just acknowledge the event. Analytics integration can be added later.
    return { acknowledged: true, kind: parsed.data };
  }
}
