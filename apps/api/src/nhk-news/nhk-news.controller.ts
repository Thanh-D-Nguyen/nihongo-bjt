import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import { NhkNewsRepository, type NhkNewsType } from "./nhk-news.repository.js";

/** Simple per-IP sliding window rate limiter for image proxy */
const IMAGE_PROXY_WINDOW_MS = 60_000;
const IMAGE_PROXY_MAX_PER_WINDOW = 60;
const imageProxyHits = new Map<string, number[]>();

function checkImageProxyRate(ip: string): boolean {
  const now = Date.now();
  const hits = (imageProxyHits.get(ip) ?? []).filter((t) => t > now - IMAGE_PROXY_WINDOW_MS);
  if (hits.length >= IMAGE_PROXY_MAX_PER_WINDOW) {
    imageProxyHits.set(ip, hits);
    return false;
  }
  hits.push(now);
  imageProxyHits.set(ip, hits);
  // Evict stale IPs periodically
  if (imageProxyHits.size > 10_000) {
    for (const [k, v] of imageProxyHits) {
      if (v.every((t) => t <= now - IMAGE_PROXY_WINDOW_MS)) imageProxyHits.delete(k);
    }
  }
  return true;
}

/** Validate URL is an NHK domain */
function isAllowedImageProxyUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      (parsed.hostname === "www3.nhk.or.jp" || parsed.hostname === "www3.nhk.jp" ||
       parsed.hostname === "nhkeasier.com" || parsed.hostname.endsWith(".nhk.or.jp"))
    );
  } catch {
    return false;
  }
}

@ApiTags("NHK News")
@Controller("nhk-news")
export class NhkNewsController {
  constructor(@Inject(NhkNewsRepository) private readonly repo: NhkNewsRepository) {}

  private imageProxyUrl(req: Request, articleUrl: string) {
    const configured = process.env.API_PUBLIC_URL?.replace(/\/$/u, "");
    const base =
      configured ||
      `${String(req.headers["x-forwarded-proto"] ?? req.protocol ?? "http").split(",")[0]}://${String(
        req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:4000"
      ).split(",")[0]}`;
    return `${base}/api/nhk-news/image?articleUrl=${encodeURIComponent(articleUrl)}`;
  }

  @Get()
  @ApiOperation({ summary: "List recent NHK News articles. type=easy|normal; default comes from admin config." })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  @ApiQuery({ name: "type", required: false, enum: ["easy", "normal"] })
  @ApiQuery({ name: "locale", required: false })
  async list(
    @Req() req: Request,
    @Query("limit") limitStr?: string,
    @Query("offset") offsetStr?: string,
    @Query("type") typeStr?: string,
    @Query("locale") locale?: string
  ) {
    const limit = limitStr ? Math.min(Math.max(parseInt(limitStr, 10) || 10, 1), 50) : 10;
    const offset = offsetStr ? Math.max(parseInt(offsetStr, 10) || 0, 0) : 0;
    const type: NhkNewsType | "default" =
      typeStr === "easy" || typeStr === "normal" ? typeStr : "default";
    const all = await this.repo.listArticles(offset + limit, type, locale === "ja" ? "ja" : "vi");
    const articles = all.slice(offset, offset + limit);
    return articles.map((article) =>
      article.sourceType === "normal" && !article.imageUrl
        ? { ...article, imageUrl: this.imageProxyUrl(req, article.url) }
        : article
    );
  }

  @Get("image")
  @ApiOperation({ summary: "Resolve and redirect to the lead image for an NHK article URL." })
  async image(@Req() req: Request, @Query("articleUrl") articleUrl: string | undefined, @Res() res: Response) {
    if (!articleUrl) throw new BadRequestException("articleUrl is required");
    if (!isAllowedImageProxyUrl(articleUrl)) throw new BadRequestException("URL must be an NHK domain");
    const clientIp = String(req.headers["x-forwarded-for"] ?? req.ip ?? "unknown").split(",")[0].trim();
    if (!checkImageProxyRate(clientIp)) throw new HttpException("Too many image proxy requests", 429);
    const imageUrl = await this.repo.resolveArticleImage(articleUrl);
    if (!imageUrl) throw new NotFoundException("Image not found");
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    return res.redirect(302, imageUrl);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get NHK News article detail with vocabulary when available" })
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

  @Post(":id/flashcards")
  @UseGuards(KeycloakAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Create a deck from all extracted vocabulary and grammar in an NHK article" })
  async createFlashcardDeck(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") articleId: string,
    @Body() body: { deckTitle?: string | null }
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const result = await this.repo.createDeckFromArticle(userId, articleId, body.deckTitle ?? null);
    if (!result) throw new NotFoundException("Article not found");
    if (result.message === "no_vocabulary") {
      throw new BadRequestException("No vocabulary or grammar found for this article");
    }
    return result;
  }

  // ─── Reading progress ───

  @Post(":id/reading")
  @UseGuards(KeycloakAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Track reading progress for an NHK article" })
  async trackReading(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") articleId: string,
    @Body() body: { readTimeSec?: number; completed?: boolean }
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const result = await this.repo.trackReading(userId, articleId, body.readTimeSec, body.completed);
    if (!result) throw new NotFoundException("Article not found");
    return result;
  }

  @Get("reading/progress")
  @UseGuards(KeycloakAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get reading progress for current user" })
  @ApiQuery({ name: "articleIds", required: false, description: "Comma-separated article IDs" })
  async readingProgress(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("articleIds") articleIdsStr?: string
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const articleIds = articleIdsStr?.split(",").filter(Boolean);
    return this.repo.getReadingProgress(userId, articleIds);
  }

  // ─── Bookmarks ───

  @Post(":id/bookmark")
  @UseGuards(KeycloakAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Toggle bookmark for an NHK article" })
  async toggleBookmark(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") articleId: string
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.repo.toggleBookmark(userId, articleId);
  }

  @Get(":id/bookmark")
  @UseGuards(KeycloakAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Check bookmark status for an NHK article" })
  async checkBookmark(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") articleId: string
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const bookmarked = await this.repo.isBookmarked(userId, articleId);
    return { bookmarked };
  }

  @Get("bookmarks")
  @UseGuards(KeycloakAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "List bookmarked NHK articles" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  async bookmarks(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query("limit") limitStr?: string,
    @Query("offset") offsetStr?: string
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const limit = limitStr ? Math.min(Math.max(parseInt(limitStr, 10) || 20, 1), 50) : 20;
    const offset = offsetStr ? Math.max(parseInt(offsetStr, 10) || 0, 0) : 0;
    return this.repo.getBookmarks(userId, limit, offset);
  }
}

@Controller("admin/nhk-news")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("content")
@LogAdminAction({ resourceType: "content.nhk_news_config" })
@ApiTags("Admin NHK News")
@ApiBearerAuth("bearer")
export class NhkNewsAdminController {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(NhkNewsRepository) private readonly repo: NhkNewsRepository
  ) {}

  @Get("config")
  @ApiOperation({ summary: "Read NHK News home configuration" })
  async config(@Req() req: Request, @Query("locale") locale?: string) {
    await this.auth.requireOneOfPermissions(req, ["admin.content.read", "admin.content.write"]);
    return this.repo.getConfig(locale === "ja" ? "ja" : "vi");
  }

  @Patch("config")
  @ApiOperation({ summary: "Update NHK Easy/normal source configuration" })
  async updateConfig(
    @Req() req: Request,
    @Query("locale") locale: string | undefined,
    @Body()
    body: {
      defaultType?: "easy" | "normal";
      easyEnabled?: boolean;
      easyFeedUrl?: string;
      normalEnabled?: boolean;
      normalFeedUrl?: string;
    }
  ) {
    await this.auth.requirePermission(req, "admin.content.write");
    if (body.defaultType && !["easy", "normal"].includes(body.defaultType)) {
      throw new BadRequestException("defaultType must be easy or normal");
    }
    return this.repo.updateConfig(locale === "ja" ? "ja" : "vi", body);
  }

  @Post("refresh")
  @ApiOperation({ summary: "Fetch both configured NHK feeds and return current status" })
  async refresh(@Req() req: Request, @Query("locale") locale?: string) {
    await this.auth.requirePermission(req, "admin.content.write");
    return this.repo.refreshPreview(locale === "ja" ? "ja" : "vi");
  }
}
