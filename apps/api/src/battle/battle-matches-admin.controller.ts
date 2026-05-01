import {
  adminBattleMatchActionBodySchema,
  adminBattleMatchListQuerySchema
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

import { BattleMatchesAdminRepository } from "./battle-matches-admin.repository.js";

/**
 * Admin Battle Matches — read + abort/rerun on `learning.battle_session`.
 *
 * Reads allow `viewer.audit` (support escalation). Abort requires `battle.manage` and is only
 * valid for `in_progress`; it sets `abandonedReason='admin_abort'`. Rerun clones the session's
 * mode/botKey/maxRounds into a fresh `in_progress` session for the same user (new fairness seed).
 * All actions audit with reason via `admin.battle.match.{aborted,rerun}`.
 */
@Controller("admin/battle/matches")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("battle")
@LogAdminAction({ resourceType: "admin.battle.match" })
@ApiTags("Admin Battle", "Battle Matches")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class BattleMatchesAdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly repo: BattleMatchesAdminRepository
  ) {}

  @Get()
  @ApiOperation({
    summary: "List battle matches (filters: status, userId, mode, date range, q on id/room).",
    description: "**RBAC:** `battle.manage` or `viewer.audit`. Pagination 25/page."
  })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "status", required: false, enum: ["in_progress", "completed", "abandoned", "all"] })
  @ApiQuery({ name: "userId", required: false })
  @ApiQuery({ name: "mode", required: false })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  @ApiQuery({ name: "page", required: false, schema: { type: "integer", default: 1 } })
  @ApiQuery({ name: "pageSize", required: false, schema: { type: "integer", default: 25 } })
  @ApiOkResponse({ description: "Paginated battle matches." })
  async list(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ["battle.manage", "viewer.audit"]);
    const parsed = adminBattleMatchListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.repo.list(parsed.data);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Match detail with full round timeline + recent audit (last 20).",
    description: "**RBAC:** `battle.manage` or `viewer.audit`. 404 if id is unknown."
  })
  @ApiParam({ name: "id" })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, ["battle.manage", "viewer.audit"]);
    const found = await this.repo.detail(id);
    if (!found) throw new BadRequestException({ code: "battle_match_not_found", id });
    return found;
  }

  @Post(":id/abort")
  @ApiOperation({
    summary: "Abort an in-progress battle match. Audited.",
    description: "**RBAC:** `battle.manage`. Body Zod: `{ reason }`. 400 if not `in_progress`."
  })
  async abort(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "battle.manage");
    const parsed = adminBattleMatchActionBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.abort(principal.actorId, id, parsed.data);
  }

  @Post(":id/rerun")
  @ApiOperation({
    summary: "Clone the match config (mode/botKey/maxRounds) into a fresh in-progress session for the same user. Audited.",
    description: "**RBAC:** `battle.manage`. Body Zod: `{ reason }`. 400 if source still `in_progress`."
  })
  async rerun(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "battle.manage");
    const parsed = adminBattleMatchActionBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.rerun(principal.actorId, id, parsed.data);
  }
}
