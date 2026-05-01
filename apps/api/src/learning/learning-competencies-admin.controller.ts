import {
  adminCompetencyCreateSchema,
  adminCompetencyListQuerySchema,
  adminCompetencyPatchSchema,
  adminCompetencyReasonOnlySchema
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

import { CompetenciesAdminRepository } from "./learning-competencies-admin.repository.js";

/**
 * Competencies admin: CRUD + lifecycle (draft/published/archived).
 * Audit codes: `admin.learning.competency.{created,updated,published,archived,deleted}`.
 */
@Controller("admin/learning/competencies")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("learning")
@LogAdminAction({ resourceType: "learning.competency" })
@ApiTags("Admin Learning", "Competencies")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class CompetenciesAdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly repo: CompetenciesAdminRepository
  ) {}

  @Get()
  @ApiOperation({ summary: "List competencies (filters: q, status, level). Pagination 25/page." })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "level", required: false })
  @ApiQuery({ name: "page", required: false, schema: { type: "integer", default: 1 } })
  @ApiQuery({ name: "pageSize", required: false, schema: { type: "integer", default: 25 } })
  @ApiOkResponse({ description: "Paginated competencies with statusCounts." })
  async list(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.read",
      "admin.content.write",
      "viewer.audit"
    ]);
    const parsed = adminCompetencyListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.list(parsed.data);
  }

  @Get(":id")
  @ApiOperation({ summary: "Detail of a competency with last 25 audit entries." })
  @ApiParam({ name: "id" })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.read",
      "admin.content.write",
      "viewer.audit"
    ]);
    const found = await this.repo.detail(id);
    if (!found) throw new BadRequestException({ code: "competency_not_found", id });
    return found;
  }

  @Post()
  @ApiOperation({ summary: "Create a competency. Audited." })
  async create(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminCompetencyCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.create(principal.actorId, parsed.data);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Partial update of a competency. Audited." })
  async patch(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminCompetencyPatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.patch(principal.actorId, id, parsed.data);
  }

  @Post(":id/publish")
  @ApiOperation({ summary: "Transition draft → published. Idempotent." })
  async publish(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminCompetencyReasonOnlySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.publish(principal.actorId, id, parsed.data.reason);
  }

  @Post(":id/archive")
  @ApiOperation({ summary: "Transition any → archived." })
  async archive(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminCompetencyReasonOnlySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.archive(principal.actorId, id, parsed.data.reason);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Hard-delete draft competency. Published/archived cannot be deleted." })
  async remove(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminCompetencyReasonOnlySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.remove(principal.actorId, id, parsed.data.reason);
  }
}
