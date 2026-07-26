import { adsRuntimeDecisionBodySchema } from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Inject,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { CurrentUser } from "../../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../../keycloak/keycloak-auth.guard.js";
import { KeycloakAuthOptional } from "../../keycloak/keycloak-public.decorator.js";
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
  @KeycloakAuthOptional()
  @Throttle({
    long: { limit: 10, ttl: 60_000 },
    medium: { limit: 5, ttl: 10_000 },
    short: { limit: 2, ttl: 1_000 }
  })
  @ApiOperation({
    description:
      "Optional Bearer authentication. Anonymous viewers are evaluated as the free audience; authenticated plans and ad-suppression entitlements are resolved server-side. Pass `learningContext.sessionKind` to enforce learning safety.",
    security: [{}, { bearer: [] }],
    summary: "Ad decision (optional auth)"
  })
  @ApiBody({
    description:
      "Anonymous clients must omit `userId`; authenticated identity is derived from the Bearer token.",
    schema: {
      type: "object",
      required: ["placementCode"],
      properties: {
        learningContext: {
          type: "object",
          properties: {
            sessionKind: {
              type: "string",
              enum: ["default", "flashcard_review", "bjt_timed", "quiz_active"]
            }
          }
        },
        locale: { type: "string", maxLength: 16 },
        placementCode: { type: "string", minLength: 1, maxLength: 64 }
      }
    }
  })
  async decision(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown
  ) {
    await this.featureGate.requireEnabled("ads.enabled", {
      message: "Ads are temporarily disabled"
    });
    const raw = body as Record<string, unknown>;
    const userId = this.resolveOptionalUserId(user, raw);
    const p = adsRuntimeDecisionBodySchema.safeParse({
      ...raw,
      ...(userId ? { userId } : {})
    });
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    return this.runtime.decide({
      learningContext: p.data.learningContext,
      locale: p.data.locale,
      placementCode: p.data.placementCode,
      userId
    });
  }

  @Post("impression")
  @KeycloakAuthOptional()
  @Throttle({
    long: { limit: 20, ttl: 60_000 },
    medium: { limit: 10, ttl: 10_000 },
    short: { limit: 4, ttl: 1_000 }
  })
  @ApiOperation({
    description:
      "Record a served impression or client-side safety block with optional Bearer authentication. Anonymous events are persisted with a null user id.",
    security: [{}, { bearer: [] }],
    summary: "Ad impression (optional auth)"
  })
  @ApiBody({
    description:
      "Anonymous clients must omit `userId`; authenticated identity is derived from the Bearer token.",
    schema: {
      type: "object",
      required: ["decisionToken", "kind", "placementCode"],
      properties: {
        campaignId: { type: "string", format: "uuid" },
        clientContext: {
          type: "object",
          properties: {
            device: { type: "string", enum: ["mobile", "desktop", "unknown"] },
            locale: { type: "string", maxLength: 16 }
          }
        },
        decisionKey: { type: "string", maxLength: 120 },
        decisionToken: { type: "string", minLength: 64, maxLength: 1024 },
        kind: { type: "string", enum: ["impression"] },
        placementCode: { type: "string", minLength: 1, maxLength: 64 }
      }
    }
  })
  async impression(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown
  ) {
    await this.featureGate.requireEnabled("ads.enabled", {
      message: "Ads are temporarily disabled"
    });
    const raw = body as Record<string, unknown>;
    const userId = this.resolveOptionalUserId(user, raw);
    return this.runtime.recordImpression(userId, {
      ...raw,
      ...(userId ? { userId } : {})
    });
  }

  @Post("click")
  @KeycloakAuthOptional()
  @Throttle({
    long: { limit: 20, ttl: 60_000 },
    medium: { limit: 10, ttl: 10_000 },
    short: { limit: 4, ttl: 1_000 }
  })
  @ApiOperation({
    description:
      "Record a click with optional Bearer authentication. Anonymous events are persisted with a null user id.",
    security: [{}, { bearer: [] }],
    summary: "Ad click (optional auth)"
  })
  @ApiBody({
    description:
      "Anonymous clients must omit `userId`; authenticated identity is derived from the Bearer token.",
    schema: {
      type: "object",
      required: ["decisionToken", "placementCode"],
      properties: {
        campaignId: { type: "string", format: "uuid" },
        clientContext: {
          type: "object",
          properties: {
            device: { type: "string", enum: ["mobile", "desktop", "unknown"] },
            locale: { type: "string", maxLength: 16 }
          }
        },
        decisionKey: { type: "string", maxLength: 120 },
        decisionToken: { type: "string", minLength: 64, maxLength: 1024 },
        placementCode: { type: "string", minLength: 1, maxLength: 64 }
      }
    }
  })
  async click(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Body() body: unknown) {
    await this.featureGate.requireEnabled("ads.enabled", {
      message: "Ads are temporarily disabled"
    });
    const raw = body as Record<string, unknown>;
    const userId = this.resolveOptionalUserId(user, raw);
    return this.runtime.recordClick(userId, {
      ...raw,
      ...(userId ? { userId } : {})
    });
  }

  private resolveOptionalUserId(
    user: KeycloakAuthenticatedUser | undefined,
    raw: Record<string, unknown>
  ): string | null {
    if (!user) {
      if (raw.userId !== undefined) {
        throw new ForbiddenException("Anonymous ad requests cannot supply a userId");
      }
      return null;
    }
    return (
      resolveLearnerUserId(user, typeof raw.userId === "string" ? raw.userId : undefined, {
        required: true
      }) ?? null
    );
  }
}
