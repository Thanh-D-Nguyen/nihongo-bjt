import { adminFlashcardGenRuleSchema } from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags
} from "@nestjs/swagger";
import type { Request } from "express";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { CardgenRepository } from "./cardgen.repository.js";

@Controller("admin/cardgen")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("admin_core")
@LogAdminAction({ resourceType: "admin.cardgen" })
@ApiTags("Admin Flashcard Generation")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class CardgenAdminController {
  constructor(
    @Inject(CardgenRepository) private readonly repo: CardgenRepository,
    @Inject(AdminAuthService) private readonly adminAuth: AdminAuthService
  ) {}

  /* ── Rules ───────────────────────────────────────────────────────────── */

  @Get("rules")
  @ApiOperation({ summary: "List all flashcard generation rules." })
  async listRules(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, [
      "content.manage",
      "viewer.audit"
    ]);
    return this.repo.listRules();
  }

  @Get("rules/:id")
  @ApiOperation({ summary: "Get a single flashcard generation rule." })
  @ApiParam({ name: "id", description: "Rule ID" })
  async getRule(@Req() req: Request, @Param("id") id: string) {
    await this.adminAuth.requireOneOfPermissions(req, [
      "content.manage",
      "viewer.audit"
    ]);
    return this.repo.findRule(id);
  }

  @Post("rules")
  @ApiOperation({ summary: "Create a new flashcard generation rule." })
  async createRule(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "content.manage");
    const parsed = adminFlashcardGenRuleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    return this.repo.createRule({
      ...parsed.data,
      filterLevel: parsed.data.filterLevel ?? null,
      filterTags: parsed.data.filterTags,
      cardTemplate: parsed.data.cardTemplate,
      actorId: principal.actorId
    });
  }

  @Put("rules/:id")
  @ApiOperation({ summary: "Update a flashcard generation rule." })
  @ApiParam({ name: "id", description: "Rule ID" })
  async updateRule(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown
  ) {
    const principal = await this.adminAuth.requirePermission(req, "content.manage");
    const parsed = adminFlashcardGenRuleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    return this.repo.updateRule(id, {
      ...parsed.data,
      filterLevel: parsed.data.filterLevel ?? null,
      filterTags: parsed.data.filterTags,
      cardTemplate: parsed.data.cardTemplate,
      actorId: principal.actorId
    });
  }

  @Delete("rules/:id")
  @ApiOperation({ summary: "Delete a flashcard generation rule." })
  @ApiParam({ name: "id", description: "Rule ID" })
  async deleteRule(@Req() req: Request, @Param("id") id: string) {
    await this.adminAuth.requirePermission(req, "content.manage");
    return this.repo.deleteRule(id);
  }

  /* ── Jobs (read-only for admin) ──────────────────────────────────────── */

  @Get("jobs")
  @ApiOperation({ summary: "List recent flashcard generation jobs (all users)." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  async listJobs(
    @Req() req: Request,
    @Param("limit") limitStr: string | undefined
  ) {
    await this.adminAuth.requireOneOfPermissions(req, [
      "content.manage",
      "viewer.audit"
    ]);
    const limit = Math.min(
      Math.max(parseInt(limitStr ?? "50", 10) || 50, 1),
      500
    );
    return this.repo.listJobs(limit);
  }

  @Get("jobs/:id")
  @ApiOperation({ summary: "Get a specific flashcard generation job." })
  @ApiParam({ name: "id", description: "Job ID" })
  async getJob(@Req() req: Request, @Param("id") id: string) {
    await this.adminAuth.requireOneOfPermissions(req, [
      "content.manage",
      "viewer.audit"
    ]);
    return this.repo.findJob(id);
  }
}
