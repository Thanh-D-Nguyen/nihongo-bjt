import {
  adminQuizSessionAbortBodySchema,
  adminQuizSessionExtendTimeBodySchema,
  adminQuizSessionListQuerySchema
} from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
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

import { QuizSessionsAdminRepository } from "./quiz-sessions-admin.repository.js";

const READ_PERMS = ["assessment.manage", "assessment.review", "viewer.audit"] as const;
const WRITE_PERM = "assessment.manage" as const;

@Controller("admin/assessment/quiz-sessions")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("assessment")
@LogAdminAction({ resourceType: "assessment.quiz_session" })
@ApiTags("Admin Assessment", "Quiz Sessions")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class QuizSessionsAdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly repo: QuizSessionsAdminRepository
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "List quiz sessions with filters: q (id partial), status, userId, testId, from, to. Pagination 25/page."
  })
  async list(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, READ_PERMS);
    const parsed = adminQuizSessionListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.list(parsed.data);
  }

  @Get(":id")
  @ApiOperation({ summary: "Quiz session detail with answer-by-answer timeline + score breakdown + audit." })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, READ_PERMS);
    const found = await this.repo.detail(id);
    if (!found) throw new BadRequestException({ code: "quiz_session_not_found", id });
    return found;
  }

  @Post(":id/abort")
  @ApiOperation({
    summary:
      "Force-abort an in_progress session (sets status=abandoned + completedAt). Audited. Idempotent on terminal states (no-op + audit)."
  })
  async abort(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminQuizSessionAbortBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.abort(principal.actorId, id, parsed.data.reason);
  }

  @Post(":id/extend-time")
  @ApiOperation({
    summary:
      "Add seconds to an in_progress session by shifting startedAt earlier (server-enforced timer). Audited."
  })
  async extendTime(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminQuizSessionExtendTimeBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.extendTime(principal.actorId, id, parsed.data.addSeconds, parsed.data.reason);
  }
}
