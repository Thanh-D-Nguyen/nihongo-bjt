import {
  Body,
  Controller,
  Get,
  Inject,
  Put,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { FlashcardStylesService } from "./flashcard-styles.service.js";

@Controller("flashcards/styles")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Flashcards", "Styles")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class FlashcardStylesController {
  constructor(
    @Inject(FlashcardStylesService) private readonly stylesService: FlashcardStylesService
  ) {}

  @Get()
  @ApiOperation({ summary: "List available flashcard styles (with lock status based on user plan)." })
  async list(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.stylesService.listForLearner(userId);
  }

  @Get("active")
  @ApiOperation({ summary: "Get the user's currently active flashcard style config." })
  async getActive(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.stylesService.getActiveStyleForUser(userId);
  }

  @Put("active")
  @ApiOperation({ summary: "Set active flashcard style. Pass null slug to reset to default." })
  @ApiBody({ schema: { type: "object", properties: { slug: { type: "string", nullable: true } } } })
  async setActive(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: { slug: string | null }
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.stylesService.setActiveStyle(userId, body.slug);
  }
}
