import { Controller, Get, Post, Param, Query, Body, Req, NotFoundException } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { MagazineRepository } from "./magazine.repository.js";
import { ListMagazineQuery, MarkReadBody } from "./dto/magazine.dto.js";

@ApiTags("Magazine")
@Controller("magazine")
export class MagazineController {
  constructor(private readonly repo: MagazineRepository) {}

  @Get()
  @ApiOperation({ summary: "List published magazine articles" })
  list(@Query() query: ListMagazineQuery) {
    return this.repo.list({
      widgetKind: query.widgetKind,
      locale: query.locale ?? "vi",
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    });
  }

  @Get("today")
  @ApiOperation({ summary: "Get today's magazine articles" })
  today(@Query("locale") locale?: string) {
    return this.repo.getToday(locale ?? "vi");
  }

  @Get(":slug")
  @ApiOperation({ summary: "Get magazine article by slug (public, no auth required)" })
  async getBySlug(@Param("slug") slug: string) {
    const article = await this.repo.getBySlug(slug);
    if (!article) throw new NotFoundException("Article not found");
    return article;
  }

  @Post(":slug/read")
  @ApiOperation({ summary: "Mark article as read and submit quiz results" })
  async markRead(
    @Param("slug") slug: string,
    @Body() body: MarkReadBody,
    @Req() req: any,
  ) {
    const userId = req.user?.sub;
    if (!userId) return { ok: false, reason: "not_authenticated" };

    const article = await this.repo.getBySlug(slug);
    if (!article) throw new NotFoundException("Article not found");

    return this.repo.markRead(userId, article.id, body);
  }
}
