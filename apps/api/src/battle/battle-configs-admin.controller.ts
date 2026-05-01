import {
  adminBattleConfigCreateSchema,
  adminBattleConfigListQuerySchema,
  adminBattleConfigPatchSchema,
  adminBattleConfigReasonOnlyBodySchema
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

import { BattleConfigsAdminRepository } from "./battle-configs-admin.repository.js";

/**
 * Admin Battle Configs CRUD + lifecycle.
 *
 * Backend re-enforces RBAC on every endpoint; the admin UI only hides buttons for UX. Audit rows
 * land on `admin.audit_log` via `BattleConfigsAdminRepository.writeAudit` with stable action codes
 * (`admin.battle.config.created|updated|published|archived|duplicated|deleted`) so support and IAM
 * timeline filters pick them up without further wiring.
 */
@Controller("admin/battle/configs")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("battle")
@LogAdminAction({ resourceType: "admin.battle.config" })
@ApiTags("Admin Battle", "Battle Configs")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class BattleConfigsAdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly repo: BattleConfigsAdminRepository
  ) {}

  @Get()
  @ApiOperation({
    summary: "List managed battle configs (filters: status, level, q). Pagination 25/page.",
    description: "**RBAC:** `battle.manage` or `viewer.audit`. Returns `{ items, total, page, pageSize }`."
  })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "status", required: false, enum: ["draft", "published", "archived", "all"] })
  @ApiQuery({ name: "level", required: false })
  @ApiQuery({ name: "page", required: false, schema: { type: "integer", default: 1 } })
  @ApiQuery({ name: "pageSize", required: false, schema: { type: "integer", default: 25 } })
  @ApiOkResponse({ description: "Paginated managed battle configs." })
  async list(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ["battle.manage", "viewer.audit"]);
    const parsed = adminBattleConfigListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.repo.list(parsed.data);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Detail of a managed battle config + recent audit entries scoped to this config (last 20).",
    description: "**RBAC:** `battle.manage` or `viewer.audit`. 404 when id is unknown."
  })
  @ApiParam({ name: "id", description: "`learning.battle_config.id` (UUID)." })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, ["battle.manage", "viewer.audit"]);
    const found = await this.repo.detail(id);
    if (!found) {
      throw new BadRequestException({ code: "battle_config_not_found", id });
    }
    return found;
  }

  @Post()
  @ApiOperation({
    summary: "Create a managed battle config (status defaults to `draft`). Audited.",
    description: "**RBAC:** `battle.manage`. Body Zod: `adminBattleConfigCreateSchema`."
  })
  async create(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "battle.manage");
    const parsed = adminBattleConfigCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.repo.create(principal.actorId, parsed.data);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Partial update of a managed battle config. Audited (before/after).",
    description: "**RBAC:** `battle.manage`. Body Zod: `adminBattleConfigPatchSchema`."
  })
  async patch(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "battle.manage");
    const parsed = adminBattleConfigPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.repo.patch(principal.actorId, id, parsed.data);
  }

  @Post(":id/publish")
  @ApiOperation({
    summary: "Transition `draft` → `published`. Idempotent (no-op if already published). Audited.",
    description: "**RBAC:** `battle.manage`. Body Zod: `{ reason }`."
  })
  async publish(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "battle.manage");
    const parsed = adminBattleConfigReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.repo.publish(principal.actorId, id, parsed.data.reason);
  }

  @Post(":id/archive")
  @ApiOperation({
    summary: "Transition any → `archived`. Audited.",
    description: "**RBAC:** `battle.manage`. Body Zod: `{ reason }`."
  })
  async archive(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "battle.manage");
    const parsed = adminBattleConfigReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.repo.archive(principal.actorId, id, parsed.data.reason);
  }

  @Post(":id/duplicate")
  @ApiOperation({
    summary: "Clone a config as a new draft (` (copy)` suffix on name). Audited.",
    description: "**RBAC:** `battle.manage`. Body Zod: `{ reason }`."
  })
  async duplicate(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "battle.manage");
    const parsed = adminBattleConfigReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.repo.duplicate(principal.actorId, id, parsed.data.reason);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Hard-delete a draft config. Published or archived configs cannot be deleted.",
    description: "**RBAC:** `battle.manage`. Body Zod: `{ reason }`. Returns `{ deleted: true, id }`."
  })
  async remove(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "battle.manage");
    const parsed = adminBattleConfigReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.repo.remove(principal.actorId, id, parsed.data.reason);
  }
}
