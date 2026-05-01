import { adsRuntimeDecisionBodySchema } from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../../openapi/common-decorators.js";
import { RuntimeFeatureGateService } from "../../operations/runtime-feature-gate.service.js";
import { AdsRuntimeService } from "./ads-runtime.service.js";

@Controller("ads")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Ads", "Monetization")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class AdsRuntimeController {
  constructor(
    @Inject(AdsRuntimeService) private readonly runtime: AdsRuntimeService,
    @Inject(RuntimeFeatureGateService) private readonly featureGate: RuntimeFeatureGateService
  ) {}

  @Post("decision")
  @ApiOperation({
    description:
      "Resolves a placement for the authenticated user. Pass `learningContext.sessionKind` to enforce learning-safety (no ads during flashcard/BJT/quiz as configured).",
    summary: "Ad decision (auth)"
  })
  @ApiBody({ description: "See `adsRuntimeDecisionBodySchema` in @nihongo-bjt/shared" })
  async decision(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Body() body: unknown) {
    await this.featureGate.requireEnabled("ads.enabled", {
      message: "Ads are temporarily disabled"
    });
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const p = adsRuntimeDecisionBodySchema.safeParse({ ...raw, userId });
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    return this.runtime.decide({
      learningContext: p.data.learningContext,
      locale: p.data.locale,
      placementCode: p.data.placementCode,
      userId: p.data.userId
    });
  }

  @Post("impression")
  @ApiOperation({
    description: "Record a served impression or a client-side safety block. No free-form text; `clientContext` is schema-limited.",
    summary: "Ad impression (auth)"
  })
  @ApiBody({ description: "See `adsRuntimeImpressionBodySchema`" })
  async impression(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Body() body: unknown) {
    await this.featureGate.requireEnabled("ads.enabled", {
      message: "Ads are temporarily disabled"
    });
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    return this.runtime.recordImpression(userId, { ...raw, userId });
  }

  @Post("click")
  @ApiOperation({ summary: "Ad click (auth)" })
  @ApiBody({ description: "See `adsRuntimeClickBodySchema`" })
  async click(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Body() body: unknown) {
    await this.featureGate.requireEnabled("ads.enabled", {
      message: "Ads are temporarily disabled"
    });
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    return this.runtime.recordClick(userId, { ...raw, userId });
  }
}
