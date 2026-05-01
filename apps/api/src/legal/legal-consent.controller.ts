import {
  legalConsentAcceptSchema,
  legalConsentStatusQuerySchema
} from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { LegalConsentService } from "./legal-consent.service.js";

@Controller("legal/consent")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Legal", "Privacy")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class LegalConsentController {
  constructor(@Inject(LegalConsentService) private readonly legalConsent: LegalConsentService) {}

  @Get("status")
  @ApiOperation({ summary: "Get required policy versions and current user consent status." })
  status(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    if (!user) {
      throw new UnauthorizedException("Authenticated user is required");
    }
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = legalConsentStatusQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.legalConsent.getStatus(parsed.data.userId);
  }

  @Post("accept")
  @ApiOperation({ summary: "Record user consent acceptance for a policy version." })
  accept(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown
  ) {
    if (!user) {
      throw new UnauthorizedException("Authenticated user is required");
    }
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const parsed = legalConsentAcceptSchema.safeParse({ ...raw, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.legalConsent.accept(parsed.data);
  }

  @Get("history")
  @ApiOperation({ summary: "Get user's full consent acceptance history (own data only)." })
  history(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    if (!user) {
      throw new UnauthorizedException("Authenticated user is required");
    }
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    return this.legalConsent.getHistory(userId);
  }
}
