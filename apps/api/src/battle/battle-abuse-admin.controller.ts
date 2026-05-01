import {
  adminBattleAbuseEscalateSchema,
  adminBattleAbuseListQuerySchema,
  adminBattleAbuseResolveSchema
} from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
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

import { BattleAbuseAdminRepository } from "./battle-abuse-admin.repository.js";

/**
 * Admin Battle Abuse moderation queue on `learning.battle_abuse_report`.
 *
 * No dedicated `battle.moderate` permission yet — falls back to `battle.manage` for
 * resolve/escalate. Reads allow `viewer.audit`. All actions audit with reason via
 * `admin.battle.abuse.{resolved,escalated}`. Adding `battle.moderate` would be a separate IAM
 * migration (out of scope for this slice — gap recorded in inventory).
 */
@Controller("admin/battle/abuse")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("battle")
@LogAdminAction({ resourceType: "admin.battle.abuse" })
@ApiTags("Admin Battle", "Battle Abuse")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class BattleAbuseAdminController {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(BattleAbuseAdminRepository) private readonly repo: BattleAbuseAdminRepository
  ) {}

  @Get()
  @ApiOperation({
    summary: "List battle abuse reports (filters: status, severity, kind, reporterId, subjectId, range).",
    description: "**RBAC:** `battle.manage` or `viewer.audit`. Pagination 25/page."
  })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "severity", required: false })
  @ApiQuery({ name: "kind", required: false })
  @ApiQuery({ name: "reporterId", required: false })
  @ApiQuery({ name: "subjectId", required: false })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  @ApiQuery({ name: "page", required: false, schema: { type: "integer", default: 1 } })
  @ApiQuery({ name: "pageSize", required: false, schema: { type: "integer", default: 25 } })
  @ApiOkResponse({ description: "Paginated battle abuse reports." })
  async list(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ["battle.manage", "viewer.audit"]);
    const parsed = adminBattleAbuseListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.list(parsed.data);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Battle abuse report detail + prior reports against same subject + audit (last 20).",
    description: "**RBAC:** `battle.manage` or `viewer.audit`. 404 if id is unknown."
  })
  @ApiParam({ name: "id" })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, ["battle.manage", "viewer.audit"]);
    const found = await this.repo.detail(id);
    if (!found) throw new BadRequestException({ code: "battle_abuse_not_found", id });
    return found;
  }

  @Post(":id/resolve")
  @ApiOperation({
    summary: "Resolve a battle abuse report with action (warning|temp_ban|perm_ban|dismissed) + notes. Audited.",
    description: "**RBAC:** `battle.manage`. Body Zod: `{ action, notes, reason }`. 400 if already resolved."
  })
  async resolve(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "battle.manage");
    const parsed = adminBattleAbuseResolveSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.resolve(principal.actorId, id, parsed.data);
  }

  @Post(":id/escalate")
  @ApiOperation({
    summary: "Escalate a battle abuse report to higher review queue (status → `escalated`). Audited.",
    description: "**RBAC:** `battle.manage`. Body Zod: `{ reason }`."
  })
  async escalate(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "battle.manage");
    const parsed = adminBattleAbuseEscalateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.escalate(principal.actorId, id, parsed.data);
  }
}
