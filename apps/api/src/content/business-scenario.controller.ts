import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { BusinessScenarioService } from "./business-scenario.service.js";

@Controller("scenarios")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Business Scenarios")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class BusinessScenarioController {
  constructor(private readonly scenarioService: BusinessScenarioService) {}

  @Get()
  @ApiOperation({ summary: "List active business scenarios." })
  list(@Query("category") category?: string) {
    return this.scenarioService.listScenarios(category);
  }

  @Get(":scenarioId")
  @ApiOperation({ summary: "Get scenario with steps and choices." })
  get(@Param("scenarioId") scenarioId: string) {
    return this.scenarioService.getScenario(scenarioId);
  }

  @Post("steps/:stepId/answer")
  @ApiOperation({ summary: "Submit a choice for a scenario step." })
  submitChoice(@Param("stepId") stepId: string, @Body() body: { choiceKey: string }) {
    return this.scenarioService.submitChoice(stepId, body.choiceKey);
  }

  @Post(":scenarioId/complete")
  @ApiOperation({ summary: "Complete a scenario and save attempt." })
  complete(
    @Param("scenarioId") scenarioId: string,
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: { choices: { stepOrder: number; choiceKey: string; points: number }[] },
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.scenarioService.completeScenario(userId, scenarioId, body.choices);
  }

  @Get(":scenarioId/attempts")
  @ApiOperation({ summary: "Get user's attempt history for a scenario." })
  getAttempts(
    @Param("scenarioId") scenarioId: string,
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.scenarioService.getAttempts(userId, scenarioId);
  }
}
