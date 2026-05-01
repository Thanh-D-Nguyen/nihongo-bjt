import {
  adminQuestionBankBulkActionSchema,
  adminQuestionBankCreateSchema,
  adminQuestionBankListQuerySchema,
  adminQuestionBankPatchSchema,
  adminQuestionBankSuggestEditSchema,
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

import { QuestionBankAdminRepository } from "./question-bank-admin.repository.js";

const READ_PERMS = ["assessment.manage", "assessment.review", "viewer.audit"] as const;
const SUGGEST_PERMS = ["assessment.manage", "assessment.review"] as const;
const WRITE_PERM = "assessment.manage" as const;

@Controller("admin/assessment/question-bank")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("assessment")
@LogAdminAction({ resourceType: "assessment.question" })
@ApiTags("Admin Assessment", "Question Bank")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class QuestionBankAdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly repo: QuestionBankAdminRepository
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "List BJT questions with filters: q (full-text on prompt/explanation), level, topic (skillTag), difficulty, status, tags (csv or array), sectionId."
  })
  async list(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, READ_PERMS);
    const parsed = adminQuestionBankListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.list(parsed.data);
  }

  @Get(":id")
  @ApiOperation({ summary: "Question detail with options + remediation link + audit." })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, READ_PERMS);
    const found = await this.repo.detail(id);
    if (!found) throw new BadRequestException({ code: "question_not_found", id });
    return found;
  }

  @Post()
  async create(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminQuestionBankCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.create(principal.actorId, parsed.data);
  }

  @Patch(":id")
  async patch(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminQuestionBankPatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.patch(principal.actorId, id, parsed.data);
  }

  @Post("bulk")
  @ApiOperation({
    summary:
      "Bulk action across question ids: publish | archive | tag | untag. Each row is audited individually."
  })
  async bulk(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminQuestionBankBulkActionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if ((parsed.data.action === "tag" || parsed.data.action === "untag") && (!parsed.data.tags || parsed.data.tags.length === 0)) {
      throw new BadRequestException({ code: "tags_required_for_tag_action" });
    }
    return this.repo.bulk(principal.actorId, parsed.data);
  }

  @Post(":id/suggest-edit")
  @ApiOperation({
    summary:
      "assessment.review users can suggest a question edit. This creates a draft suggestion in the audit log only — the live question is NOT mutated."
  })
  async suggestEdit(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requireOneOfPermissions(req, SUGGEST_PERMS);
    const parsed = adminQuestionBankSuggestEditSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.suggestEdit(principal.actorId, id, parsed.data);
  }

  @Delete(":id")
  async remove(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminMockExamReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.remove(principal.actorId, id, parsed.data.reason);
  }
}
