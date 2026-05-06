import { companionHintQuerySchema } from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { CompanionHintService } from "./companion-hint.service.js";

@Controller("companion")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Companion")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class CompanionController {
  constructor(@Inject(CompanionHintService) private readonly companionHint: CompanionHintService) {}

  @Get("hint")
  @ApiOperation({
    summary: "Next-step study hint for the learner shell (deterministic ranker over real signals)."
  })
  @ApiQuery({ name: "days", required: false, description: "Analytics window 1–90, default 7" })
  @ApiQuery({ name: "userId", required: false, description: "Profile id (dev override if allowed)" })
  hint(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true });
    if (userId === undefined) {
      throw new BadRequestException("userId_required");
    }
    const parsed = companionHintQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.companionHint.hintForLearner(userId, parsed.data.days);
  }
}
