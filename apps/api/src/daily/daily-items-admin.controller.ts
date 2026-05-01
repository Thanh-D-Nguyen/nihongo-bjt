import {
  adminDailyContentItemCreateSchema,
  adminDailyContentItemListQuerySchema,
  adminDailyContentItemPatchSchema,
  adminDailyContentItemReasonOnlySchema
} from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags
} from "@nestjs/swagger";
import type { Request } from "express";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";

import { DailyItemsAdminRepository } from "./daily-items-admin.repository.js";

/**
 * Daily content items admin: scheduled phrase/grammar/quiz items per locale per date.
 *
 * Lifecycle: draft → (scheduled | published) → archived. Only drafts are deletable. Engagement
 * stats (per-actionType counts) live on `detail` so admins can drill into how a published item
 * performed.
 *
 * Audit codes: `admin.daily.item.{created,updated,scheduled,published,archived,deleted}`.
 */
@Controller("admin/daily/items")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("daily")
@LogAdminAction({ resourceType: "daily.daily_content_item" })
@ApiTags("Admin Daily", "Daily Content Items")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class DailyItemsAdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly repo: DailyItemsAdminRepository
  ) {}

  @Get()
  @ApiOperation({
    summary: "List daily content items (filters: q, status, locale, widgetKind, from, to)."
  })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "locale", required: false })
  @ApiQuery({ name: "widgetKind", required: false })
  @ApiQuery({ name: "from", required: false, description: "YYYY-MM-DD" })
  @ApiQuery({ name: "to", required: false, description: "YYYY-MM-DD" })
  @ApiQuery({ name: "page", required: false, schema: { type: "integer", default: 1 } })
  @ApiQuery({ name: "pageSize", required: false, schema: { type: "integer", default: 25 } })
  @ApiOkResponse({ description: "Paginated daily content items with statusCounts." })
  async list(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.read",
      "admin.content.write",
      "viewer.audit"
    ]);
    const parsed = adminDailyContentItemListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.list(parsed.data);
  }

  @Get(":id")
  @ApiOperation({ summary: "Detail with engagement counts and audit." })
  @ApiParam({ name: "id" })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.read",
      "admin.content.write",
      "viewer.audit"
    ]);
    const found = await this.repo.detail(id);
    if (!found) throw new BadRequestException({ code: "daily_item_not_found", id });
    return found;
  }

  @Post()
  @ApiOperation({ summary: "Create a daily content item (status defaults to draft). Audited." })
  async create(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminDailyContentItemCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.create(principal.actorId, parsed.data);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Partial update of a daily content item. Audited." })
  async patch(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminDailyContentItemPatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.patch(principal.actorId, id, parsed.data);
  }

  @Post(":id/schedule")
  @ApiOperation({ summary: "Transition draft → scheduled. Audited." })
  async schedule(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminDailyContentItemReasonOnlySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.schedule(principal.actorId, id, parsed.data.reason);
  }

  @Post(":id/publish")
  @ApiOperation({ summary: "Transition any non-archived → published. Idempotent." })
  async publish(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminDailyContentItemReasonOnlySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.publish(principal.actorId, id, parsed.data.reason);
  }

  @Post(":id/archive")
  @ApiOperation({ summary: "Transition any → archived. Audited." })
  async archive(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminDailyContentItemReasonOnlySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.archive(principal.actorId, id, parsed.data.reason);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Hard-delete a draft item. Other states cannot be deleted." })
  async remove(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminDailyContentItemReasonOnlySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.remove(principal.actorId, id, parsed.data.reason);
  }
}
