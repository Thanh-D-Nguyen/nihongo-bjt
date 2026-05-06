import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import { NhkNewsRepository } from "./nhk-news.repository.js";

@ApiTags("NHK News")
@Controller("nhk-news")
export class NhkNewsController {
  constructor(@Inject(NhkNewsRepository) private readonly repo: NhkNewsRepository) {}

  @Get()
  @ApiOperation({ summary: "List recent NHK Easy News articles" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async list(@Query("limit") limitStr?: string) {
    const limit = limitStr ? Math.min(Math.max(parseInt(limitStr, 10) || 10, 1), 30) : 10;
    return this.repo.listArticles(limit);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get NHK Easy News article detail with vocabulary" })
  async detail(@Param("id") id: string) {
    const article = await this.repo.getArticleDetail(id);
    if (!article) throw new NotFoundException("Article not found");
    return article;
  }

  @Post(":id/flashcard")
  @UseGuards(KeycloakAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Create a flashcard from NHK article vocabulary" })
  async createFlashcard(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") articleId: string,
    @Body()
    body: {
      word: string;
      reading?: string;
      meaning?: string;
      cardType: "kanji" | "vocabulary" | "grammar";
    }
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    if (!body.word || !body.cardType) {
      throw new BadRequestException("word and cardType are required");
    }
    return this.repo.createFlashcardFromArticle(
      userId,
      articleId,
      body.word,
      body.reading ?? null,
      body.meaning ?? null,
      body.cardType
    );
  }
}
