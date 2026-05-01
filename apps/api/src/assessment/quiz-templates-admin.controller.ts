import {
  adminQuizTemplateCreateSchema,
  adminQuizTemplateListQuerySchema,
  adminQuizTemplatePatchSchema,
  adminQuizTemplateReasonOnlyBodySchema
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
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";

import { QuizTemplatesAdminRepository } from "./quiz-templates-admin.repository.js";

const READ_PERMS = ["assessment.manage", "assessment.review", "viewer.audit"] as const;
const WRITE_PERM = "assessment.manage" as const;

@Controller("admin/assessment/quiz-templates")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("assessment")
@LogAdminAction({ resourceType: "assessment.quiz_template" })
@ApiTags("Admin Assessment", "Quiz Templates")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class QuizTemplatesAdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly repo: QuizTemplatesAdminRepository
  ) {}

  @Get()
  @ApiOperation({ summary: "List quiz templates (filters: q, status, level, type). Pagination 25/page." })
  async list(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, READ_PERMS);
    const parsed = adminQuizTemplateListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.list(parsed.data);
  }

  @Get(":id")
  @ApiOperation({ summary: "Quiz template detail with sample-generated quiz preview + audit." })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, READ_PERMS);
    const found = await this.repo.detail(id);
    if (!found) throw new BadRequestException({ code: "quiz_template_not_found", id });
    return found;
  }

  @Post()
  async create(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminQuizTemplateCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.create(principal.actorId, parsed.data);
  }

  @Patch(":id")
  async patch(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminQuizTemplatePatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.patch(principal.actorId, id, parsed.data);
  }

  @Post(":id/publish")
  async publish(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminQuizTemplateReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.publish(principal.actorId, id, parsed.data.reason);
  }

  @Post(":id/archive")
  async archive(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminQuizTemplateReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.archive(principal.actorId, id, parsed.data.reason);
  }

  @Post(":id/duplicate")
  async duplicate(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminQuizTemplateReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.duplicate(principal.actorId, id, parsed.data.reason);
  }

  @Delete(":id")
  async remove(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminQuizTemplateReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.remove(principal.actorId, id, parsed.data.reason);
  }
}
