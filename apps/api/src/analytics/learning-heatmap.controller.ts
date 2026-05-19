import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { LearningHeatmapService } from "./learning-heatmap.service.js";

@Controller("analytics/heatmap")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Analytics")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class LearningHeatmapController {
  constructor(@Inject(LearningHeatmapService) private readonly heatmapService: LearningHeatmapService) {}

  @Get()
  @ApiOperation({ summary: "Get learning heatmap data (last 365 days)." })
  getHeatmap(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("days") daysStr?: string,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const days = Math.min(Math.max(parseInt(daysStr ?? "365", 10) || 365, 30), 365);
    return this.heatmapService.getHeatmap(userId, days);
  }
}
