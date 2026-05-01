import {
  adminRemediationRuleCreateSchema,
  adminRemediationRuleListQuerySchema,
  adminRemediationRulePatchSchema,
  adminRemediationToggleBodySchema,
  adminRemediationTriggerListQuerySchema
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

import { RemediationAdminRepository } from "./remediation-admin.repository.js";

const READ_PERMS = ["assessment.manage", "assessment.review", "viewer.audit"] as const;
const WRITE_PERM = "assessment.manage" as const;

@Controller("admin/assessment/remediation")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("assessment")
@LogAdminAction({ resourceType: "assessment.remediation_rule" })
@ApiTags("Admin Assessment", "Remediation")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class RemediationAdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly repo: RemediationAdminRepository
  ) {}

  @Get("rules")
  @ApiOperation({ summary: "List remediation rules (filters: q, topicSkillTag, level, active)." })
  async listRules(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, READ_PERMS);
    const parsed = adminRemediationRuleListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.listRules(parsed.data);
  }

  @Get("rules/:id")
  async ruleDetail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, READ_PERMS);
    const found = await this.repo.ruleDetail(id);
    if (!found) throw new BadRequestException({ code: "remediation_rule_not_found", id });
    return found;
  }

  @Post("rules")
  async createRule(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminRemediationRuleCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.createRule(principal.actorId, parsed.data);
  }

  @Patch("rules/:id")
  async patchRule(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminRemediationRulePatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.patchRule(principal.actorId, id, parsed.data);
  }

  @Post("rules/:id/enable")
  async enableRule(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminRemediationToggleBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.toggleRule(principal.actorId, id, true, parsed.data.reason);
  }

  @Post("rules/:id/disable")
  async disableRule(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminRemediationToggleBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.toggleRule(principal.actorId, id, false, parsed.data.reason);
  }

  @Delete("rules/:id")
  async removeRule(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, WRITE_PERM);
    const parsed = adminRemediationToggleBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.removeRule(principal.actorId, id, parsed.data.reason);
  }

  @Get("triggers")
  @ApiOperation({ summary: "Read-only triggers timeline (filters: ruleId, userId, from, to)." })
  async listTriggers(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, READ_PERMS);
    const parsed = adminRemediationTriggerListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.listTriggers(parsed.data);
  }
}
