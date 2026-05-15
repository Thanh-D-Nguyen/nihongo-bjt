import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { RevengeModeService } from "./revenge-mode.service.js";

@Controller("quiz/revenge")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Quiz", "Revenge Mode")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class RevengeModeController {
  constructor(private readonly revengeService: RevengeModeService) {}

  @Get("queue")
  @ApiOperation({
    summary:
      "Get revenge queue — wrong answers from last 7 days not yet correctly re-answered.",
  })
  getQueue(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("limit") limitStr?: string,
  ) {
    const userId = resolveLearnerUserId(user, undefined, {
      required: true,
    })!;
    const limit = Math.min(
      Math.max(parseInt(limitStr ?? "5", 10) || 5, 1),
      10,
    );
    return this.revengeService.getRevengeQueue(userId, limit);
  }

  @Post("answer")
  @ApiOperation({ summary: "Submit a revenge answer." })
  submitAnswer(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: { questionId: string; selectedOption: string },
  ) {
    const userId = resolveLearnerUserId(user, undefined, {
      required: true,
    })!;
    const { questionId, selectedOption } = body;
    if (!questionId || !selectedOption) {
      throw new BadRequestException(
        "questionId and selectedOption required",
      );
    }
    return this.revengeService.submitAnswer(userId, questionId, selectedOption);
  }

  @Get("stats")
  @ApiOperation({ summary: "Get revenge mode stats." })
  getStats(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    const userId = resolveLearnerUserId(user, undefined, {
      required: true,
    })!;
    return this.revengeService.getStats(userId);
  }
}
