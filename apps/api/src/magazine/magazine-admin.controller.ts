import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards, NotFoundException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiBody, ApiParam, ApiQuery } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { MagazineRepository } from "./magazine.repository.js";
import { MagazineGenerationService } from "./magazine-generation.service.js";
import { AdminGenerateBody, ListMagazineQuery } from "./dto/magazine.dto.js";

@ApiTags("Admin – Magazine")
@Controller("admin/magazine")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("content")
@LogAdminAction({ resourceType: "admin.magazine" })
@ApiBearerAuth("bearer")
export class MagazineAdminController {
  constructor(
    private readonly repo: MagazineRepository,
    private readonly generation: MagazineGenerationService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List all magazine articles (admin, includes drafts)" })
  @ApiQuery({ name: "widgetKind", required: false, type: String })
  @ApiQuery({ name: "locale", required: false, type: String })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiOkResponse({ description: "Paginated list of magazine articles including drafts." })
  list(@Query() query: ListMagazineQuery) {
    return this.repo.list({
      widgetKind: query.widgetKind,
      locale: query.locale ?? "vi",
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      status: undefined, // show all statuses for admin
    });
  }

  @Post("generate")
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: "Trigger AI content generation for a specific date/type" })
  @ApiBody({ type: AdminGenerateBody })
  @ApiOkResponse({ description: "Generation result with article ID (null if already exists)." })
  async generate(@Body() body: AdminGenerateBody) {
    const id = await this.generation.generateForDate(
      body.widgetKind,
      new Date(body.date),
      body.locale ?? "vi",
    );
    return { id, generated: !!id };
  }

  @Post(":id/regenerate")
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: "Regenerate article content with AI (deletes old, creates new)" })
  @ApiParam({ name: "id", description: "Article slug or UUID" })
  @ApiOkResponse({ description: "Regeneration result with new article ID." })
  async regenerate(@Param("id") id: string) {
    const article = await this.repo.getBySlug(id);
    if (!article) {
      throw new NotFoundException("Article not found");
    }
    const newId = await this.generation.regenerate(
      article.widgetKind,
      article.contentDate,
      article.locale,
    );
    return { id: newId, regenerated: true };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete magazine article permanently" })
  @ApiParam({ name: "id", description: "Article UUID" })
  @ApiOkResponse({ description: "Deletion confirmation." })
  async remove(@Param("id") id: string) {
    await this.repo.delete(id);
    return { deleted: true };
  }
}
