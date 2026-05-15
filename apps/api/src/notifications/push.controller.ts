import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { PushNotificationService } from "./push-notification.service.js";

@Controller("notifications/push")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Notifications")
@ApiBearerAuth("bearer")
export class PushController {
  constructor(private readonly pushService: PushNotificationService) {}

  @Post("subscribe")
  @ApiOperation({ summary: "Subscribe to web push notifications." })
  @DocumentedHttpErrors()
  async subscribe(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const userId = resolveLearnerUserId(user, undefined, {
      required: true,
    })!;
    const raw = body as Record<string, unknown>;
    const subscription = raw.subscription as
      | { endpoint: string; keys: { p256dh: string; auth: string } }
      | undefined;
    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      throw new BadRequestException("Invalid subscription object");
    }
    const ua = req.headers["user-agent"];
    return this.pushService.subscribe(userId, subscription, ua);
  }

  @Delete("subscribe")
  @ApiOperation({ summary: "Unsubscribe from web push notifications." })
  @DocumentedHttpErrors()
  async unsubscribe(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown,
  ) {
    const userId = resolveLearnerUserId(user, undefined, {
      required: true,
    })!;
    const raw = body as Record<string, unknown>;
    const endpoint = String(raw.endpoint ?? "");
    if (!endpoint) {
      throw new BadRequestException("Missing endpoint");
    }
    return this.pushService.unsubscribe(userId, endpoint);
  }
}
