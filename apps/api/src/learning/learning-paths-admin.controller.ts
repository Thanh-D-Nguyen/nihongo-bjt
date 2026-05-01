import {
  adminLearningPathCreateSchema,
  adminLearningPathListQuerySchema,
  adminLearningPathPatchSchema,
  adminLearningPathReasonOnlySchema
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

import { LearningPathsAdminRepository } from "./learning-paths-admin.repository.js";

/**
 * Learning Paths admin: CRUD + lifecycle (draft/published/archived) + duplicate.
 * Audit codes: `admin.learning.path.{created,updated,published,archived,duplicated,deleted}`.
 * RBAC: `admin.content.write` for writes; reads accept any of
 * `admin.content.read|admin.content.write|viewer.audit`.
 */
@Controller("admin/learning/paths")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("learning")
@LogAdminAction({ resourceType: "learning.learning_path" })
@ApiTags("Admin Learning", "Learning Paths")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class LearningPathsAdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly repo: LearningPathsAdminRepository
  ) {}

  @Get()
  @ApiOperation({
    summary: "List learning paths (filters: q, status, targetLevel). Pagination 25/page.",
    description: "**RBAC:** `admin.content.read|write` or `viewer.audit`."
  })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["draft", "published", "archived", "all"]
  })
  @ApiQuery({ name: "targetLevel", required: false })
  @ApiQuery({ name: "page", required: false, schema: { type: "integer", default: 1 } })
  @ApiQuery({ name: "pageSize", required: false, schema: { type: "integer", default: 25 } })
  @ApiOkResponse({ description: "Paginated learning paths with statusCounts." })
  async list(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.read",
      "admin.content.write",
      "viewer.audit"
    ]);
    const parsed = adminLearningPathListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.list(parsed.data);
  }

  @Get(":id")
  @ApiOperation({ summary: "Detail of a learning path with last 25 audit entries." })
  @ApiParam({ name: "id", description: "`learning.learning_path.id` (UUID)." })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.read",
      "admin.content.write",
      "viewer.audit"
    ]);
    const found = await this.repo.detail(id);
    if (!found) throw new BadRequestException({ code: "learning_path_not_found", id });
    return found;
  }

  @Post()
  @ApiOperation({ summary: "Create a learning path (status defaults to `draft`). Audited." })
  async create(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminLearningPathCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.create(principal.actorId, parsed.data);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Partial update of a learning path. Audited (before/after)." })
  async patch(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminLearningPathPatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.patch(principal.actorId, id, parsed.data);
  }

  @Post(":id/publish")
  @ApiOperation({ summary: "Transition `draft` → `published`. Idempotent. Audited." })
  async publish(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminLearningPathReasonOnlySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.publish(principal.actorId, id, parsed.data.reason);
  }

  @Post(":id/archive")
  @ApiOperation({ summary: "Transition any → `archived`. Audited." })
  async archive(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminLearningPathReasonOnlySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.archive(principal.actorId, id, parsed.data.reason);
  }

  @Post(":id/duplicate")
  @ApiOperation({ summary: "Clone the path as a new draft. Audited." })
  async duplicate(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminLearningPathReasonOnlySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.duplicate(principal.actorId, id, parsed.data.reason);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Hard-delete a draft path. Published or archived cannot be deleted." })
  async remove(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminLearningPathReasonOnlySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.remove(principal.actorId, id, parsed.data.reason);
  }
}
