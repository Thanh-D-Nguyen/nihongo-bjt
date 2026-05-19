import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { WeeklyReportService } from "./weekly-report.service.js";

@Controller("analytics/weekly-report")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Analytics")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class WeeklyReportController {
  constructor(@Inject(WeeklyReportService) private readonly weeklyReportService: WeeklyReportService) {}

  @Get("latest")
  @ApiOperation({ summary: "Get the most recent weekly report for the authenticated learner." })
  getLatest(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.weeklyReportService.getLatest(userId);
  }

  @Get("history")
  @ApiOperation({ summary: "Get weekly report history (default last 8 weeks)." })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "Number of weeks 1–52, default 8" })
  getHistory(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("limit") limitStr?: string,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const limit = Math.min(Math.max(parseInt(limitStr ?? "8", 10) || 8, 1), 52);
    return this.weeklyReportService.getHistory(userId, limit);
  }
}
