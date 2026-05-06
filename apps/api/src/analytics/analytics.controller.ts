import {
  adminAnalyticsExecutiveQuerySchema,
  analyticsEventSchema,
  analyticsRangeQuerySchema
} from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import type { Request } from "express";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { KeycloakAuthOptional, PublicRoute } from "../keycloak/keycloak-public.decorator.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { AnalyticsRepository } from "./analytics.repository.js";

@Controller("analytics")
@ApiTags("Analytics")
@DocumentedHttpErrors()
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsRepository) private readonly analyticsRepository: AnalyticsRepository
  ) {}

  @Post("events")
  @PublicRoute()
  @ApiOperation({ summary: "Ingest a single analytics event (public; validate server-side in production).", description: "No JWT required. Body must match `analyticsEventSchema` (Zod)." })
  @ApiBody({ description: "Analytics event DTO (see `analyticsEventSchema` in @nihongo-bjt/shared)." })
  ingest(@Body() body: unknown) {
    const parsed = analyticsEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.analyticsRepository.ingest(parsed.data);
  }

  @Get("learner")
  @UseGuards(KeycloakAuthGuard)
  @KeycloakAuthOptional()
  @ApiOperation({
    summary: "Learner analytics snapshot (date range, optional user scope).",
    description:
      "Optional Keycloak-issued **Bearer** token for authenticated scope; query matches `analyticsRangeQuerySchema` (`days`, optional `userId` in dev)."
  })
  @ApiQuery({ name: "days", required: false, type: Number, description: "Lookback 1–90, default 7" })
  @ApiQuery({ name: "userId", required: false, description: "Profile id (optional; dev override if allowed)" })
  @ApiQuery({ name: "locale", required: false, description: "Locale for coaching insight (vi|ja), default en" })
  learner(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: false });
    const parsed = analyticsRangeQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.analyticsRepository.learner(parsed.data.days, parsed.data.userId, query.locale);
  }
}

@Controller("admin/analytics")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("analytics")
@LogAdminAction({ resourceType: "admin.analytics" })
@ApiTags("Admin", "Analytics")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class AdminAnalyticsController {
  constructor(
    @Inject(AdminAuthService) private readonly adminAuth: AdminAuthService,
    @Inject(AnalyticsRepository) private readonly analyticsRepository: AnalyticsRepository
  ) {}

  @Get()
  @ApiOperation({
    summary: "Executive / rollup analytics (admin read-only)",
    description:
      "RBAC: one of `viewer.analytics`, `admin.analytics.view`, `analytics.view`. " +
      "Monetization block requires `revenue.analytics.view` in addition to dashboard access (checked server-side)."
  })
  @ApiQuery({ name: "days", required: false, type: Number, description: "Window 1–90 days, default 7" })
  @ApiQuery({ name: "locale", required: false, description: "User locale filter: all|vi|ja" })
  @ApiQuery({ name: "plan", required: false, description: "Optional plan slug filter" })
  @ApiQuery({ name: "segment", required: false, description: "User segment: all|new|returning (returning not applied yet)" })
  async executive(
    @Req() req: Request,
    @Query() query: Record<string, string | undefined>
  ) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [
      "viewer.analytics",
      "admin.analytics.view",
      "analytics.view"
    ]);
    const parsed = adminAnalyticsExecutiveQuerySchema.safeParse({
      days: query.days,
      locale: query.locale,
      plan: query.plan,
      segment: query.segment
    });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const canMonet = principal.permissions.has("revenue.analytics.view");

    return this.analyticsRepository.adminExecutive(parsed.data.days, {
      filterLocale: parsed.data.locale,
      includeMonetization: canMonet,
      planSlug: parsed.data.plan,
      segment: parsed.data.segment
    });
  }
}
