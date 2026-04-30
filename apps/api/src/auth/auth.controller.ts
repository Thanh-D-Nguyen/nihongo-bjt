import {
  authLinkExchangeSchema,
  authProfileUpdateSchema,
  userScopedQuerySchema
} from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Body,
  UseGuards
} from "@nestjs/common";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { ApiOkResponse } from "@nestjs/swagger";
import { KeycloakUserService } from "../keycloak/keycloak-user.service.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { LearnerProfileEnvelopeOpenApiDto } from "../openapi/dto/backend-api-openapi.dto.js";
import { AuthService } from "./auth.service.js";

@Controller("auth")
@ApiTags("Auth", "Users")
@ApiOkResponse({ description: "Successful auth/profile response." })
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(KeycloakUserService) private readonly keycloakUsers: KeycloakUserService
  ) {}

  @Get("me")
  @UseGuards(KeycloakAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Current learner profile and Keycloak `sub` (public profile fields only)." })
  @ApiOkResponse({ type: LearnerProfileEnvelopeOpenApiDto })
  @DocumentedHttpErrors()
  async me(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    if (!user) {
      throw new NotFoundException();
    }
    const profile = await this.keycloakUsers.getLearnerPublicProfile(user.appUserId);
    if (!profile) {
      throw new NotFoundException();
    }
    return { profile, sub: user.sub };
  }

  @Post("profile")
  @UseGuards(KeycloakAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({
    summary: "Canonical v15 profile sync from verified JWT.",
    description: "Returns the current app profile for the authenticated Keycloak subject. No raw token data is returned."
  })
  @ApiOkResponse({ type: LearnerProfileEnvelopeOpenApiDto })
  @DocumentedHttpErrors()
  async syncProfile(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    return this.profile(user);
  }

  @Get("profile")
  @UseGuards(KeycloakAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Canonical v15 current learner profile." })
  @ApiOkResponse({ type: LearnerProfileEnvelopeOpenApiDto })
  @DocumentedHttpErrors()
  async profile(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    if (!user) {
      throw new NotFoundException();
    }
    const profile = await this.keycloakUsers.getLearnerPublicProfile(user.appUserId);
    if (!profile) {
      throw new NotFoundException();
    }
    return { profile };
  }

  @Put("profile")
  @UseGuards(KeycloakAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({
    summary: "Update current learner profile.",
    description: "Validated profile fields only; email, status, and Keycloak linkage are not user-writable."
  })
  @ApiOkResponse({ type: LearnerProfileEnvelopeOpenApiDto })
  @DocumentedHttpErrors()
  async updateProfile(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown
  ) {
    if (!user) {
      throw new NotFoundException();
    }
    const parsed = authProfileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const profile = await this.keycloakUsers.updateLearnerProfile(user.appUserId, parsed.data);
    return { profile };
  }

  @Get("identities")
  @UseGuards(KeycloakAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Linked social/OIDC identities for the current user (no provider tokens in response)." })
  @DocumentedHttpErrors()
  list(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const p = userScopedQuerySchema.safeParse({ ...query, userId });
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    return this.auth.listIdentities(p.data.userId);
  }

  @Delete("identities/:id")
  @UseGuards(KeycloakAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Unlink an identity; cannot remove last login method (enforced in service).", description: "Requires `userId` in query in dev; token wins in production." })
  @ApiParam({ name: "id" })
  @DocumentedHttpErrors()
  unlink(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") id: string,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const p = userScopedQuerySchema.safeParse({ ...query, userId });
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    return this.auth.unlinkIdentity({ accountId: id, userId: p.data.userId });
  }

  @Post("link/exchange")
  @ApiOperation({ summary: "Exchange one-time code from OAuth link flow (server-side; no client secret in body)." })
  @DocumentedHttpErrors()
  exchange(@Body() body: unknown) {
    const p = authLinkExchangeSchema.safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    return this.auth.exchangeLinkCode(p.data.code);
  }
}
