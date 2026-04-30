import {
  adsLearningContextSchema,
  monetizationAdDecideQuerySchema,
  monetizationCheckoutSchema,
  monetizationUserQuerySchema
} from "@nihongo-bjt/shared";
import { createPrismaClient, type Prisma, type PrismaClient } from "@nihongo-bjt/database";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags
} from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import type { AdLearningContext } from "./ads/ad-provider.js";
import { LocalAdProvider } from "./ads/local-ad.provider.js";
import { LocalBillingProvider } from "./billing/local-billing.provider.js";
import { EntitlementService } from "./entitlement.service.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { RuntimeFeatureGateService } from "../operations/runtime-feature-gate.service.js";
import { LegalConsentService } from "../legal/legal-consent.service.js";
import { QuotaService } from "./quota.service.js";

@Controller("learner")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Monetization", "Ads")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class LearnerMonetizationController {
  private readonly prisma: PrismaClient = createPrismaClient();

  constructor(
    private readonly billing: LocalBillingProvider,
    private readonly ads: LocalAdProvider,
    private readonly entitlements: EntitlementService,
    private readonly quota: QuotaService,
    private readonly featureGate: RuntimeFeatureGateService,
    private readonly legalConsent: LegalConsentService
  ) {}

  @Get("monetization/summary")
  @ApiOperation({
    summary: "Entitlements, plan slug, and flashcard day quota for user",
    description: "Requires Keycloak **Bearer** token. `userId` in query is dev override; validated with `monetizationUserQuerySchema`."
  })
  @ApiQuery({ name: "userId", required: true, description: "Profile id (or dev override)" })
  async summary(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = monetizationUserQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const flash = await this.quota.getFlashcardDaySummary(parsed.data.userId);
    const ent = await this.entitlements.listEntitlementKeysForUser(parsed.data.userId);
    return { entitlements: ent.entitlements, flashcardDay: flash, planSlug: ent.planSlug };
  }

  @Post("monetization/checkout")
  @ApiOperation({
    summary: "Start local / dev checkout session",
    description: "Body: `monetizationCheckoutSchema` (includes `userId`, `planSlug`). **No** client secret in request."
  })
  @ApiBody({ description: "See `monetizationCheckoutSchema` in @nihongo-bjt/shared" })
  async checkout(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown
  ) {
    if (!user) {
      throw new UnauthorizedException("Authenticated user is required");
    }
    await this.featureGate.requireEnabled("billing.stripe.enabled", {
      message: "Checkout is temporarily disabled"
    });
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = monetizationCheckoutSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.legalConsent.requireCheckoutConsent(parsed.data.userId);
    const res = await this.billing.startLocalCheckout(parsed.data);
    await this.prisma.analyticsEvent.create({
      data: {
        eventName: "monetization_checkout_session",
        payload: {
          planSlug: parsed.data.planSlug,
          provider: res.provider
        } as Prisma.InputJsonValue,
        source: "api",
        userId: parsed.data.userId
      }
    });
    return res;
  }

  @Get("monetization/ad")
  @ApiOperation({
    summary: "Resolve ad for placement (placement code + user)",
    description:
      "Query: `monetizationAdDecideQuerySchema`. Optional `learningContext` is JSON string (see `adsLearningContextSchema` in @nihongo-bjt/shared)."
  })
  @ApiQuery({ name: "placementCode", required: true })
  @ApiQuery({ name: "userId", required: true, description: "App user (or dev override)" })
  @ApiQuery({ name: "learningContext", required: false, description: "JSON string for learning safety" })
  @ApiQuery({ name: "locale", required: false })
  async ad(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    await this.featureGate.requireEnabled("ads.enabled", {
      message: "Ads are temporarily disabled"
    });
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = monetizationAdDecideQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    let learningContext: AdLearningContext | undefined;
    if (parsed.data.learningContext) {
      let rawJson: unknown;
      try {
        rawJson = JSON.parse(parsed.data.learningContext) as unknown;
      } catch {
        throw new BadRequestException("Invalid learningContext JSON");
      }
      const lc = adsLearningContextSchema.safeParse(rawJson);
      if (!lc.success) {
        throw new BadRequestException(lc.error.flatten());
      }
      learningContext = lc.data;
    }
    const decision = await this.ads.decide({
      learningContext,
      locale: parsed.data.locale,
      placementCode: parsed.data.placementCode,
      userId: parsed.data.userId
    });
    if (decision.eligible) {
      await this.prisma.analyticsEvent.create({
        data: {
          eventName: "monetization_ad_decision",
          payload: {
            decisionKey: decision.decisionKey,
            placement: parsed.data.placementCode
          } as Prisma.InputJsonValue,
          source: "api",
          userId: parsed.data.userId
        }
      });
    }
    return decision;
  }

  @Post("monetization/paywall")
  @ApiOperation({ summary: "Record paywall impression (analytics only)", description: "Body per `monetizationUserQuerySchema`." })
  @ApiBody({ description: "Must include resolvable `userId`" })
  async paywall(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown
  ) {
    await this.featureGate.requireEnabled("billing.stripe.enabled", {
      message: "Paywall is temporarily disabled"
    });
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = monetizationUserQuerySchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.prisma.analyticsEvent.create({
      data: {
        eventName: "monetization_paywall_view",
        payload: { surface: "client" } as Prisma.InputJsonValue,
        source: "api",
        userId: parsed.data.userId
      }
    });
    return { ok: true };
  }
}
