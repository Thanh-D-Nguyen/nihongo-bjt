import { Controller, Get, Inject, Post, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { SeasonalEventService } from "./seasonal-event.service.js";

@Controller("gamification/events")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Gamification", "Seasonal Events")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class SeasonalEventController {
  constructor(@Inject(SeasonalEventService) private readonly eventService: SeasonalEventService) {}

  @Get()
  @ApiOperation({ summary: "Get active seasonal events." })
  getActiveEvents() {
    return this.eventService.getActiveEvents();
  }

  @Get(":eventId")
  @ApiOperation({ summary: "Get event detail with user progress." })
  getEvent(
    @Param("eventId") eventId: string,
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.eventService.getEventWithProgress(eventId, userId);
  }

  @Post(":eventId/join")
  @ApiOperation({ summary: "Join a seasonal event." })
  joinEvent(
    @Param("eventId") eventId: string,
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.eventService.joinEvent(eventId, userId);
  }
}
