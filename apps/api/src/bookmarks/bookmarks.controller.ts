import { bookmarkParamsSchema, userScopedQuerySchema } from "@nihongo-bjt/shared";
import { BadRequestException, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { BookmarkToggleOpenApiDto } from "../openapi/dto/backend-api-openapi.dto.js";
import { BookmarksService } from "./bookmarks.service.js";

@Controller("bookmarks")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Bookmarks")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class BookmarksController {
  constructor(@Inject(BookmarksService) private readonly bookmarks: BookmarksService) {}

  @Get("check/:type/:id")
  @ApiOperation({ summary: "Check if the current learner bookmarked a target." })
  @ApiOkResponse({ type: BookmarkToggleOpenApiDto })
  @ApiParam({ name: "type", enum: ["word", "lexeme", "kanji", "grammar"] })
  @ApiParam({ name: "id" })
  check(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param() params: Record<string, string>,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = bookmarkParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.bookmarks.check(userId, parsed.data.type, parsed.data.id);
  }

  @Post(":type/:id")
  @ApiOperation({ summary: "Toggle bookmark for a word/kanji/grammar target." })
  @ApiOkResponse({ type: BookmarkToggleOpenApiDto })
  @ApiParam({ name: "type", enum: ["word", "lexeme", "kanji", "grammar"] })
  @ApiParam({ name: "id" })
  toggle(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param() params: Record<string, string>,
    @Query() query: Record<string, string | undefined>
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = bookmarkParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.bookmarks.toggle(userId, parsed.data.type, parsed.data.id);
  }

  @Get("words")
  @ApiOperation({ summary: "List dictionary word bookmarks." })
  @ApiQuery({ name: "limit", required: false, example: 20 })
  words(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Query() query: Record<string, string | undefined>) {
    return this.list(user, query, "word");
  }

  @Get("kanji")
  @ApiOperation({ summary: "List kanji bookmarks." })
  kanji(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Query() query: Record<string, string | undefined>) {
    return this.list(user, query, "kanji");
  }

  @Get("grammar")
  @ApiOperation({ summary: "List grammar bookmarks." })
  grammar(@CurrentUser() user: KeycloakAuthenticatedUser | undefined, @Query() query: Record<string, string | undefined>) {
    return this.list(user, query, "grammar");
  }

  private list(
    user: KeycloakAuthenticatedUser | undefined,
    query: Record<string, string | undefined>,
    type: "word" | "kanji" | "grammar"
  ) {
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const parsed = userScopedQuerySchema.safeParse({ ...query, userId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.bookmarks.list(parsed.data.userId, type, parsed.data.limit);
  }
}
