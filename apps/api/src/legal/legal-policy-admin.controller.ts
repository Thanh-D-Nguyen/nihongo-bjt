import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { LegalPolicyAdminService, listQuerySchema } from "./legal-policy-admin.service.js";

const LEGAL_ADMIN_PERMS = ["admin.legal.write", "legal.admin"];
const LEGAL_READ_PERMS = ["admin.legal.read", "admin.legal.write", "legal.admin", "viewer.audit"];

/**
 * Admin controller for versioned legal policy management.
 * All mutations are recorded by AdminAuditInterceptor against resourceType=admin.legal_policy.
 * LegalConsentService.requireCheckoutConsent reads DB-driven versions for runtime gating.
 */
@Controller("admin/legal/policies")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("legal")
@LogAdminAction({ resourceType: "admin.legal_policy" })
@ApiTags("Admin", "Legal")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class LegalPolicyAdminController {
  constructor(
    private readonly adminAuth: AdminAuthService,
    private readonly legalPolicyAdmin: LegalPolicyAdminService
  ) {}

  @Get()
  @ApiOperation({ summary: "List legal policy versions with optional policyKey/status filters." })
  @ApiQuery({ name: "policyKey", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 100 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  async list(@Req() req: Request, @Query() query: Record<string, unknown>) {
    await this.adminAuth.requireOneOfPermissions(req, LEGAL_READ_PERMS);
    const parsed = listQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.legalPolicyAdmin.listPolicies(parsed.data);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a legal policy version detail with audit trail." })
  @ApiParam({ name: "id", description: "Legal policy version UUID" })
  async detail(@Req() req: Request, @Param("id", ParseUUIDPipe) id: string) {
    await this.adminAuth.requireOneOfPermissions(req, LEGAL_READ_PERMS);
    return this.legalPolicyAdmin.getPolicy(id);
  }

  @Get(":id/diff")
  @ApiOperation({ summary: "Diff two legal policy versions (current id vs `against` id)." })
  @ApiParam({ name: "id", description: "Legal policy version UUID" })
  @ApiQuery({ name: "against", required: true })
  async diff(
    @Req() req: Request,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("against", new ParseUUIDPipe()) against: string
  ) {
    await this.adminAuth.requireOneOfPermissions(req, LEGAL_READ_PERMS);
    return this.legalPolicyAdmin.diffPolicies(id, against);
  }

  @Post()
  @ApiOperation({ summary: "Create a new legal policy version (RBAC: legal.admin write)." })
  async create(@Req() req: Request, @Body() body: unknown) {
    await this.adminAuth.requireOneOfPermissions(req, LEGAL_ADMIN_PERMS);
    return this.legalPolicyAdmin.createPolicy(body);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a draft legal policy version (RBAC: legal.admin write)." })
  @ApiParam({ name: "id", description: "Legal policy version UUID" })
  async update(
    @Req() req: Request,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown
  ) {
    await this.adminAuth.requireOneOfPermissions(req, LEGAL_ADMIN_PERMS);
    return this.legalPolicyAdmin.updatePolicy(id, body);
  }

  @Patch(":id/publish")
  @ApiOperation({
    summary: "Publish a legal policy version (RBAC: legal.admin write)",
    description:
      "Once published, learners will be required to consent to the new version on next gated action."
  })
  @ApiParam({ name: "id", description: "Legal policy version UUID" })
  async publish(@Req() req: Request, @Param("id", ParseUUIDPipe) id: string) {
    await this.adminAuth.requireOneOfPermissions(req, LEGAL_ADMIN_PERMS);
    return this.legalPolicyAdmin.publishPolicy(id);
  }

  @Patch(":id/archive")
  @ApiOperation({ summary: "Archive a legal policy version (RBAC: legal.admin write)." })
  @ApiParam({ name: "id", description: "Legal policy version UUID" })
  async archive(@Req() req: Request, @Param("id", ParseUUIDPipe) id: string) {
    await this.adminAuth.requireOneOfPermissions(req, LEGAL_ADMIN_PERMS);
    return this.legalPolicyAdmin.archivePolicy(id);
  }

  @Post(":id/duplicate")
  @ApiOperation({
    summary: "Duplicate a legal policy version into a new draft (RBAC: legal.admin write)."
  })
  @ApiParam({ name: "id", description: "Legal policy version UUID" })
  async duplicate(@Req() req: Request, @Param("id", ParseUUIDPipe) id: string) {
    await this.adminAuth.requireOneOfPermissions(req, LEGAL_ADMIN_PERMS);
    return this.legalPolicyAdmin.duplicatePolicy(id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a draft-only legal policy version (RBAC: legal.admin write)." })
  @ApiParam({ name: "id", description: "Legal policy version UUID" })
  async remove(@Req() req: Request, @Param("id", ParseUUIDPipe) id: string) {
    await this.adminAuth.requireOneOfPermissions(req, LEGAL_ADMIN_PERMS);
    return this.legalPolicyAdmin.deletePolicy(id);
  }
}
