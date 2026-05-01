import {
  adminBattleBotCreateSchema,
  adminBattleBotListQuerySchema,
  adminBattleBotPatchSchema,
  adminBattleBotReasonOnlyBodySchema
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

import { BattleBotsAdminRepository } from "./battle-bots-admin.repository.js";

/**
 * Admin Battle Bots CRUD on `learning.battle_bot`.
 *
 * Editorial bot personas (distinct from code-defined `BATTLE_BOT_PROFILES` runtime registry). All
 * mutations require `battle.manage` and audit with reason via `admin.battle.bot.{created|updated|
 * toggled|archived|deleted}`. Soft-archive before delete (`archived` → `delete` only).
 */
@Controller("admin/battle/bots")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("battle")
@LogAdminAction({ resourceType: "admin.battle.bot" })
@ApiTags("Admin Battle", "Battle Bots")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class BattleBotsAdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly repo: BattleBotsAdminRepository
  ) {}

  @Get()
  @ApiOperation({
    summary: "List managed battle bots (filters: status, difficulty, q).",
    description: "**RBAC:** `battle.manage` or `viewer.audit`. Pagination 25/page."
  })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "status", required: false, enum: ["active", "disabled", "archived", "all"] })
  @ApiQuery({ name: "difficulty", required: false, enum: ["easy", "medium", "hard", "all"] })
  @ApiQuery({ name: "page", required: false, schema: { type: "integer", default: 1 } })
  @ApiQuery({ name: "pageSize", required: false, schema: { type: "integer", default: 25 } })
  @ApiOkResponse({ description: "Paginated managed battle bots." })
  async list(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ["battle.manage", "viewer.audit"]);
    const parsed = adminBattleBotListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.list(parsed.data);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Detail of a managed battle bot + recent audit (last 20).",
    description: "**RBAC:** `battle.manage` or `viewer.audit`. 404 if id is unknown."
  })
  @ApiParam({ name: "id" })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, ["battle.manage", "viewer.audit"]);
    const found = await this.repo.detail(id);
    if (!found) throw new BadRequestException({ code: "battle_bot_not_found", id });
    return found;
  }

  @Post()
  @ApiOperation({
    summary: "Create a managed battle bot (status defaults to `active`). Audited.",
    description: "**RBAC:** `battle.manage`. Body Zod: `adminBattleBotCreateSchema`."
  })
  async create(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "battle.manage");
    const parsed = adminBattleBotCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.create(principal.actorId, parsed.data);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Partial update of a managed battle bot. Audited (before/after).",
    description: "**RBAC:** `battle.manage`. Body Zod: `adminBattleBotPatchSchema`."
  })
  async patch(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "battle.manage");
    const parsed = adminBattleBotPatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.patch(principal.actorId, id, parsed.data);
  }

  @Post(":id/enable")
  @ApiOperation({
    summary: "Enable a battle bot (`disabled` → `active`). Audited.",
    description: "**RBAC:** `battle.manage`. Body Zod: `{ reason }`. 400 if archived."
  })
  async enable(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "battle.manage");
    const parsed = adminBattleBotReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.toggle(principal.actorId, id, parsed.data.reason, "active");
  }

  @Post(":id/disable")
  @ApiOperation({
    summary: "Disable a battle bot (`active` → `disabled`). Audited.",
    description: "**RBAC:** `battle.manage`. Body Zod: `{ reason }`. 400 if archived."
  })
  async disable(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "battle.manage");
    const parsed = adminBattleBotReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.toggle(principal.actorId, id, parsed.data.reason, "disabled");
  }

  @Post(":id/archive")
  @ApiOperation({
    summary: "Soft-archive a battle bot (any status → `archived`). Audited.",
    description: "**RBAC:** `battle.manage`. Body Zod: `{ reason }`."
  })
  async archive(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "battle.manage");
    const parsed = adminBattleBotReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.archive(principal.actorId, id, parsed.data.reason);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Hard-delete an archived bot. Active or disabled bots cannot be deleted.",
    description: "**RBAC:** `battle.manage`. Body Zod: `{ reason }`. Returns `{ deleted: true, id }`."
  })
  async remove(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "battle.manage");
    const parsed = adminBattleBotReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.remove(principal.actorId, id, parsed.data.reason);
  }
}
