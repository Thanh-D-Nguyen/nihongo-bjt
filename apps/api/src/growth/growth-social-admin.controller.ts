import {
  adminGrowthReasonOnlyBodySchema,
  adminGrowthShareEventListQuerySchema,
  adminGrowthShareModerateBodySchema,
  adminGrowthSocialTemplateCreateSchema,
  adminGrowthSocialTemplateListQuerySchema,
  adminGrowthSocialTemplatePatchSchema
} from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";

import { GrowthSocialAdminRepository } from "./growth-social-admin.repository.js";

/**
 * Admin Social Sharing: share template CRUD (publish/archive) + share-event log + moderation
 * (dismiss / hide-from-public / report-to-legal). Privacy class enforced server-side. Audit codes:
 * `admin.growth.social_template.{created|updated|published|archived}`,
 * `admin.growth.share_item.{dismiss|hide_from_public|report_to_legal}`.
 */
@Controller("admin/growth/social")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("growth")
@LogAdminAction({ resourceType: "growth.social" })
@ApiTags("Admin Growth", "Social")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class GrowthSocialAdminController {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(GrowthSocialAdminRepository) private readonly repo: GrowthSocialAdminRepository
  ) {}

  // ---------- Templates ----------

  @Get("templates")
  @ApiOperation({ summary: "List social share templates (filters: q, kind, status)." })
  async listTemplates(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ["growth.manage", "admin.growth.read", "viewer.audit"]);
    const parsed = adminGrowthSocialTemplateListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.listTemplates(parsed.data);
  }

  @Get("templates/:id")
  @ApiOperation({ summary: "Detail of a social template + last 20 audit entries." })
  async detailTemplate(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, ["growth.manage", "admin.growth.read", "viewer.audit"]);
    const found = await this.repo.detailTemplate(id);
    if (!found) throw new BadRequestException({ code: "social_template_not_found", id });
    return found;
  }

  @Post("templates")
  @ApiOperation({ summary: "Create a social template (defaults to inactive). Audited." })
  async createTemplate(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "growth.manage");
    const parsed = adminGrowthSocialTemplateCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.createTemplate(principal.actorId, parsed.data);
  }

  @Patch("templates/:id")
  @ApiOperation({ summary: "Update a social template. Bumps version. Audited." })
  async patchTemplate(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "growth.manage");
    const parsed = adminGrowthSocialTemplatePatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.patchTemplate(principal.actorId, id, parsed.data);
  }

  @Post("templates/:id/publish")
  @ApiOperation({
    summary: "Publish a social template. Public privacy class requires noPiiVerified=true."
  })
  async publishTemplate(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "growth.manage");
    const parsed = adminGrowthReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.publishTemplate(principal.actorId, id, parsed.data.reason);
  }

  @Post("templates/:id/archive")
  @ApiOperation({ summary: "Archive (deactivate) a social template. Audited." })
  async archiveTemplate(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "growth.manage");
    const parsed = adminGrowthReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.archiveTemplate(principal.actorId, id, parsed.data.reason);
  }

  // ---------- Share events ----------

  @Get("events")
  @ApiOperation({
    summary: "Read-only paginated share-event log (filter: q, templateId, userId, hidden, dateRange)."
  })
  async listEvents(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ["growth.manage", "admin.growth.read", "viewer.audit"]);
    const parsed = adminGrowthShareEventListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.listEvents(parsed.data);
  }

  @Post("events/:id/moderate")
  @ApiOperation({
    summary: "Moderate a share event: dismiss / hide-from-public / report-to-legal. Audited."
  })
  async moderate(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "growth.manage");
    const parsed = adminGrowthShareModerateBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.moderateEvent(principal.actorId, id, parsed.data.action, parsed.data.reason);
  }
}
