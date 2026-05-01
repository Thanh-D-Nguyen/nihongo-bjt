import {
  adminMockExamCreateSchema,
  adminMockExamListQuerySchema,
  adminMockExamPatchSchema,
  adminMockExamReasonOnlyBodySchema
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

import { MockExamsAdminRepository } from "./mock-exams-admin.repository.js";

const READ_PERMS = ["assessment.manage", "assessment.review", "viewer.audit"] as const;
const WRITE_PERM = "assessment.manage" as const;

@Controller("admin/assessment/mock-exams")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("assessment")
@LogAdminAction({ resourceType: "assessment.mock_exam" })
@ApiTags("Admin Assessment", "Mock Exams")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class MockExamsAdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly repo: MockExamsAdminRepository
  ) {}

  @Get()
  @ApiOperation({ summary: "List BJT mock exams (filters: q, status, level). Pagination 25/page." })
  async list(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, READ_PERMS);
    const parsed = adminMockExamListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.list(parsed.data);
  }

  @Get(":id")
  @ApiOperation({ summary: "Mock exam detail with sections preview, audience estimate, audit." })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, READ_PERMS);
    const found = await this.repo.detail(id);
    if (!found) throw new BadRequestException({ code: "mock_exam_not_found", id });
    return found;
  }

  @Post()
  @ApiOperation({ summary: "Create a mock exam (status defaults to draft). Audited." })
  async create(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminMockExamCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.create(principal.actorId, parsed.data);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Patch mock exam. Audited (before/after)." })
  async patch(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminMockExamPatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.patch(principal.actorId, id, parsed.data);
  }

  @Post(":id/publish")
  @ApiOperation({ summary: "Transition draft → published. Idempotent. Audited." })
  async publish(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminMockExamReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.publish(principal.actorId, id, parsed.data.reason);
  }

  @Post(":id/archive")
  @ApiOperation({ summary: "Transition any → archived. Audited." })
  async archive(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminMockExamReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.archive(principal.actorId, id, parsed.data.reason);
  }

  @Post(":id/duplicate")
  @ApiOperation({ summary: "Clone a mock exam as a new draft (' (copy)' suffix). Audited." })
  async duplicate(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminMockExamReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.duplicate(principal.actorId, id, parsed.data.reason);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Hard-delete a draft mock exam (only draft). Audited." })
  async remove(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminMockExamReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.remove(principal.actorId, id, parsed.data.reason);
  }
}
