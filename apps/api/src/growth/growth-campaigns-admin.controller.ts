import {
  adminGrowthCampaignCreateSchema,
  adminGrowthCampaignListQuerySchema,
  adminGrowthCampaignPatchSchema,
  adminGrowthReasonOnlyBodySchema
} from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
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

import { GrowthCampaignsAdminRepository } from "./growth-campaigns-admin.repository.js";

/**
 * Admin Growth Campaigns CRUD + lifecycle (in-product growth pushes: email/push/in-app).
 *
 * Reads require `growth.manage`, `admin.growth.read`, or `viewer.audit`. Writes require
 * `growth.manage`. Every mutation is audited under `admin.audit_log` with stable action codes
 * `admin.growth.campaign.{created|updated|scheduled|active|ended|archived|duplicated}`.
 */
@Controller("admin/growth/campaigns")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("growth")
@LogAdminAction({ resourceType: "growth.campaign" })
@ApiTags("Admin Growth", "Growth Campaigns")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class GrowthCampaignsAdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly repo: GrowthCampaignsAdminRepository
  ) {}

  @Get()
  @ApiOperation({
    summary: "List growth campaigns (filters: q, status, channel). Pagination 25/page.",
    description: "**RBAC:** `growth.manage`, `admin.growth.read`, or `viewer.audit`."
  })
  async list(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ["growth.manage", "admin.growth.read", "viewer.audit"]);
    const parsed = adminGrowthCampaignListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.list(parsed.data);
  }

  @Get("audience-estimate")
  @ApiOperation({
    summary: "Estimate audience size for a draft campaign filter combination.",
    description: "**RBAC:** `growth.manage`, `admin.growth.read`, or `viewer.audit`."
  })
  async audienceEstimate(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ["growth.manage", "admin.growth.read", "viewer.audit"]);
    const audience = {
      locale: query.locale,
      plan: query.plan,
      level: query.level,
      country: query.country
    };
    return this.repo.estimateAudienceSize(audience);
  }

  @Get(":id")
  @ApiOperation({ summary: "Detail of a growth campaign + last 20 audit entries + ethics warnings." })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, ["growth.manage", "admin.growth.read", "viewer.audit"]);
    const found = await this.repo.detail(id);
    if (!found) throw new BadRequestException({ code: "growth_campaign_not_found", id });
    return found;
  }

  @Post()
  @ApiOperation({ summary: "Create growth campaign (status defaults to draft). Audited." })
  async create(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "growth.manage");
    const parsed = adminGrowthCampaignCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.create(principal.actorId, parsed.data);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Partial update of a growth campaign. Audited (before/after)." })
  async patch(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "growth.manage");
    const parsed = adminGrowthCampaignPatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.patch(principal.actorId, id, parsed.data);
  }

  @Post(":id/schedule")
  @ApiOperation({ summary: "Transition any → scheduled. Audited." })
  async schedule(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "growth.manage");
    const parsed = adminGrowthReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.transition(principal.actorId, id, "scheduled", parsed.data.reason);
  }

  @Post(":id/activate")
  @ApiOperation({ summary: "Transition any → active. Audited." })
  async activate(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "growth.manage");
    const parsed = adminGrowthReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.transition(principal.actorId, id, "active", parsed.data.reason);
  }

  @Post(":id/end")
  @ApiOperation({ summary: "Transition any → ended. Audited." })
  async end(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "growth.manage");
    const parsed = adminGrowthReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.transition(principal.actorId, id, "ended", parsed.data.reason);
  }

  @Post(":id/archive")
  @ApiOperation({ summary: "Transition any → archived. Audited." })
  async archive(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "growth.manage");
    const parsed = adminGrowthReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.transition(principal.actorId, id, "archived", parsed.data.reason);
  }

  @Post(":id/duplicate")
  @ApiOperation({ summary: "Clone a campaign as a new draft (` (copy)` suffix on name). Audited." })
  async duplicate(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "growth.manage");
    const parsed = adminGrowthReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.duplicate(principal.actorId, id, parsed.data.reason);
  }
}
