import { Body, Controller, Get, Inject, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { LearnerService } from "./learner.service.js";

@Controller("learner")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Study", "Users")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class LearnerController {
  constructor(@Inject(LearnerService) private readonly learner: LearnerService) {}

  @Get("onboarding")
  @ApiOperation({ summary: "Learner onboarding state (current step, etc.)." })
  getOnboarding(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    return this.learner.getOnboarding({ ...query, userId });
  }

  @Post("placement/start")
  @ApiOperation({ summary: "Start placement (BJT/level) session." })
  startPlacement(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: Record<string, unknown>
  ) {
    const userId = resolveLearnerUserId(user, body.userId as string | undefined, { required: true })!;
    return this.learner.startPlacement({ ...body, userId });
  }

  @Post("placement/submit")
  @ApiOperation({ summary: "Submit placement answers." })
  submitPlacement(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: Record<string, unknown>
  ) {
    const userId = resolveLearnerUserId(user, body.userId as string | undefined, { required: true })!;
    return this.learner.submitPlacement({ ...body, userId });
  }

  @Get("notification-preferences")
  @ApiOperation({ summary: "Get notification channel preferences." })
  getNotifPreferences(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    return this.learner.getNotificationPreferences({ ...query, userId });
  }

  @Put("notification-preferences")
  @ApiOperation({ summary: "Update notification preferences." })
  putNotifPreferences(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: Record<string, unknown>
  ) {
    const userId = resolveLearnerUserId(user, body.userId as string | undefined, { required: true })!;
    return this.learner.updateNotificationPreferences({ ...body, userId });
  }

  @Get("in-app-notifications")
  @ApiOperation({ summary: "List in-app notification inbox." })
  listInApp(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    return this.learner.listInAppNotifications({ ...query, userId });
  }

  @Post("in-app-notifications/:id/read")
  @ApiOperation({ summary: "Mark one in-app notification as read." })
  markRead(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    const userId = resolveLearnerUserId(user, body.userId as string | undefined, { required: true })!;
    return this.learner.markInAppRead(id, { ...body, userId });
  }

  @Post("privacy/requests")
  @ApiOperation({ summary: "Create privacy export/delete request (GDPR-style flow)." })
  createPrivacyRequest(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: Record<string, unknown>
  ) {
    const userId = resolveLearnerUserId(user, body.userId as string | undefined, { required: true })!;
    return this.learner.createPrivacyRequest({ ...body, userId });
  }

  @Get("privacy/requests")
  @ApiOperation({ summary: "List privacy requests for user." })
  listPrivacy(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    return this.learner.listPrivacyRequests({ ...query, userId });
  }
}
