import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { KeycloakAuthOptional } from "../keycloak/keycloak-public.decorator.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { CareerRpgService, DEV_CAREER_USER_ID } from "./career-rpg.service.js";

@Controller("career")
@UseGuards(KeycloakAuthGuard)
@KeycloakAuthOptional()
@ApiTags("Career RPG")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class CareerController {
  constructor(@Inject(CareerRpgService) private readonly svc: CareerRpgService) {}

  @Get("me")
  @ApiOperation({ summary: "Get or create the current learner's Career RPG state." })
  @ApiQuery({ name: "userId", required: false, description: "Dev override; normally resolved from Keycloak." })
  me(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Query("userId") requestedUserId?: string) {
    const userId = resolveCareerUserId(user, requestedUserId);
    return this.svc.careerMe(userId);
  }

  @Post("clock-in")
  @ApiOperation({ summary: "Idempotently clock in for the current Tokyo day." })
  @ApiBody({ required: false, description: "Optional dev body `{ userId }` when Keycloak is disabled." })
  clockIn(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Body() body: unknown) {
    const raw = (body ?? {}) as Record<string, unknown>;
    const userId = resolveCareerUserId(user, typeof raw.userId === "string" ? raw.userId : undefined);
    return this.svc.clockIn(userId);
  }

  @Get("ranks")
  @ApiOperation({ summary: "List the Career RPG rank ladder." })
  ranks() {
    return this.svc.ranks();
  }

  @Patch("me")
  @ApiOperation({ summary: "Update the learner's Career RPG profile (e.g. Japanese work name)." })
  @ApiBody({ description: "Fields to update: `{ jpWorkName?, userId? }`." })
  updateProfile(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Body() body: unknown) {
    const raw = (body ?? {}) as Record<string, unknown>;
    const userId = resolveCareerUserId(user, typeof raw.userId === "string" ? raw.userId : undefined);
    return this.svc.updateProfile(userId, {
      jpWorkName: typeof raw.jpWorkName === "string" ? raw.jpWorkName : undefined
    });
  }
}

@Controller("story")
@UseGuards(KeycloakAuthGuard)
@KeycloakAuthOptional()
@ApiTags("Career RPG Story")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class StoryController {
  constructor(@Inject(CareerRpgService) private readonly svc: CareerRpgService) {}

  @Get("arcs")
  @ApiOperation({ summary: "List published story arcs with user lock/progress state." })
  @ApiQuery({ name: "userId", required: false, description: "Dev override; normally resolved from Keycloak." })
  arcs(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Query("userId") requestedUserId?: string) {
    const userId = resolveCareerUserId(user, requestedUserId);
    return this.svc.arcs(userId);
  }

  @Get("arcs/:slug")
  @ApiOperation({ summary: "Get story arc detail and chapters." })
  @ApiParam({ name: "slug", description: "Mission arc slug." })
  @ApiQuery({ name: "userId", required: false, description: "Dev override; normally resolved from Keycloak." })
  arcDetail(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("slug") slug: string,
    @Query("userId") requestedUserId?: string
  ) {
    const userId = resolveCareerUserId(user, requestedUserId);
    return this.svc.arcDetail(userId, slug);
  }

  @Get("chapters/:id")
  @ApiOperation({ summary: "Get story chapter detail and scenario payload." })
  @ApiParam({ name: "id", description: "Mission chapter id." })
  @ApiQuery({ name: "userId", required: false, description: "Dev override; normally resolved from Keycloak." })
  chapter(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") id: string,
    @Query("userId") requestedUserId?: string
  ) {
    const userId = resolveCareerUserId(user, requestedUserId);
    return this.svc.chapter(userId, id);
  }

  @Post("chapters/:id/attempts")
  @ApiOperation({ summary: "Start or return current in-progress chapter attempt." })
  @ApiParam({ name: "id", description: "Mission chapter id." })
  @ApiBody({ required: false, description: "Optional dev body `{ userId }` when Keycloak is disabled." })
  startAttempt(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const raw = (body ?? {}) as Record<string, unknown>;
    const userId = resolveCareerUserId(user, typeof raw.userId === "string" ? raw.userId : undefined);
    return this.svc.startAttempt(userId, id);
  }

  @Post("chapters/:id/attempts/current/complete")
  @ApiOperation({ summary: "Complete current attempt once and apply Career RPG rewards server-side." })
  @ApiParam({ name: "id", description: "Mission chapter id." })
  @ApiBody({ required: false, description: "Optional dev body `{ userId }` when Keycloak is disabled." })
  completeAttempt(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const raw = (body ?? {}) as Record<string, unknown>;
    const userId = resolveCareerUserId(user, typeof raw.userId === "string" ? raw.userId : undefined);
    return this.svc.completeCurrentAttempt(userId, id);
  }
}

function resolveCareerUserId(user: KeycloakAuthenticatedUser | undefined, requestedUserId: string | undefined) {
  const resolved = resolveLearnerUserId(user, requestedUserId, { required: false });
  if (resolved) {
    return resolved;
  }
  if (process.env.NODE_ENV === "production") {
    throw new BadRequestException("userId is required");
  }
  return DEV_CAREER_USER_ID;
}
