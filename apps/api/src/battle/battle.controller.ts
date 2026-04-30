import { battleRecentQuerySchema } from "@nihongo-bjt/shared";
import { BadRequestException, Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { BattleRepository } from "./battle.repository.js";

@Controller("battle")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Battle")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class BattleController {
  constructor(@Inject(BattleRepository) private readonly battleRepository: BattleRepository) {}

  @Get("sessions/recent")
  @ApiOperation({
    summary: "List recent battle sessions for user",
    description: "Keycloak-issued **Bearer** JWT. Query: `battleRecentQuerySchema` (`userId`, `limit`)."
  })
  @ApiQuery({ name: "userId", required: true, description: "App user id" })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "1–20, default 10" })
  recent(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = battleRecentQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.battleRepository.listRecentForUser(parsed.data.userId, parsed.data.limit);
  }
}
