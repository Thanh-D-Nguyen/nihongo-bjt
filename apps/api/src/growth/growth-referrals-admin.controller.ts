import {
  adminGrowthReferralListQuerySchema,
  adminGrowthReasonOnlyBodySchema
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

import { GrowthReferralsAdminRepository } from "./growth-referrals-admin.repository.js";

/**
 * Admin Referrals: list user-owned referral codes with abuse heuristics (>10 referral events in
 * the last hour). System-owned referral campaigns are NOT yet schema-supported (partial scope).
 * Revoke = hard-delete + audit. Audit code: `admin.growth.referral_code.revoked`.
 */
@Controller("admin/growth/referrals")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("growth")
@LogAdminAction({ resourceType: "growth.referral_code" })
@ApiTags("Admin Growth", "Referrals")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class GrowthReferralsAdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly repo: GrowthReferralsAdminRepository
  ) {}

  @Get()
  @ApiOperation({ summary: "List user-owned referral codes with abuse flags. Filter `flagged=true` to show only flagged." })
  async list(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ["growth.manage", "admin.growth.read", "viewer.audit"]);
    const parsed = adminGrowthReferralListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.list(parsed.data);
  }

  @Get(":id")
  @ApiOperation({ summary: "Detail of a referral code, recent events, and audit history." })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, ["growth.manage", "admin.growth.read", "viewer.audit"]);
    const found = await this.repo.detail(id);
    if (!found) throw new BadRequestException({ code: "referral_code_not_found", id });
    return found;
  }

  @Post(":id/revoke")
  @ApiOperation({ summary: "Revoke (delete) a referral code (fraud / abuse). Audited." })
  async revoke(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "growth.manage");
    const parsed = adminGrowthReasonOnlyBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.revoke(principal.actorId, id, parsed.data.reason);
  }
}
