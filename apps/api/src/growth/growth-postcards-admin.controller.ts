import {
  adminGrowthPostcardCreateSchema,
  adminGrowthPostcardListQuerySchema,
  adminGrowthPostcardPatchSchema,
  adminGrowthReasonOnlyBodySchema
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

import { GrowthPostcardsAdminRepository } from "./growth-postcards-admin.repository.js";

/**
 * Admin Postcard template CRUD + publish/archive. Privacy class enforced server-side: publishing a
 * `public` template requires `config.noPiiVerified=true`. Audit codes:
 * `admin.growth.postcard_template.{created|updated|published|archived}`.
 */
@Controller("admin/growth/postcards")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("growth")
@LogAdminAction({ resourceType: "growth.postcard_template" })
@ApiTags("Admin Growth", "Postcards")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class GrowthPostcardsAdminController {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(GrowthPostcardsAdminRepository) private readonly repo: GrowthPostcardsAdminRepository
  ) {}

  @Get()
  @ApiOperation({ summary: "List postcard templates (filters: q, kind, status). Pagination 25/page." })
  async list(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ["growth.manage", "admin.growth.read", "viewer.audit"]);
    const parsed = adminGrowthPostcardListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.list(parsed.data);
  }

  @Get(":id")
  @ApiOperation({ summary: "Detail of a postcard template + last 20 audit entries." })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, ["growth.manage", "admin.growth.read", "viewer.audit"]);
    const found = await this.repo.detail(id);
    if (!found) throw new BadRequestException({ code: "postcard_template_not_found", id });
    return found;
  }

  @Post()
  @ApiOperation({ summary: "Create a postcard template (defaults to inactive/draft). Audited." })
  async create(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "growth.manage");
    const parsed = adminGrowthPostcardCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.create(principal.actorId, parsed.data);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a postcard template. Bumps version. Audited." })
  async patch(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "growth.manage");
    const parsed = adminGrowthPostcardPatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.patch(principal.actorId, id, parsed.data);
  }

  @Post(":id/publish")
  @ApiOperation({
    summary: "Publish (activate) a postcard template. Public privacy class requires noPiiVerified."
  })
  async publish(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "growth.manage");
    const parsed = adminGrowthReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.publish(principal.actorId, id, parsed.data.reason);
  }

  @Post(":id/archive")
  @ApiOperation({ summary: "Archive (deactivate) a postcard template. Audited." })
  async archive(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "growth.manage");
    const parsed = adminGrowthReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.archive(principal.actorId, id, parsed.data.reason);
  }
}
