import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import type { Request } from "express";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiSecurity, ApiTags } from "@nestjs/swagger";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { LegalPolicyAdminService } from "./legal-policy-admin.service.js";

const LEGAL_ADMIN_PERMS = ["admin.legal.write", "legal.admin"];
const LEGAL_READ_PERMS = ["admin.legal.read", "admin.legal.write", "legal.admin"];

/**
 * Admin controller for versioned legal policy management.
 * All mutations should be followed by consent version check on gated actions
 * (LegalConsentService.requireCheckoutConsent reads DB-driven versions).
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
  @ApiOperation({ summary: "List all legal policy versions (RBAC: legal.admin read)" })
  async list(@Req() req: Request, @Query("policyKey") policyKey?: string) {
    await this.adminAuth.requireOneOfPermissions(req, LEGAL_READ_PERMS);
    return this.legalPolicyAdmin.listPolicies(policyKey);
  }

  @Post()
  @ApiOperation({ summary: "Create a new legal policy version (RBAC: legal.admin write)" })
  async create(@Req() req: Request, @Body() body: unknown) {
    await this.adminAuth.requireOneOfPermissions(req, LEGAL_ADMIN_PERMS);
    return this.legalPolicyAdmin.createPolicy(body);
  }

  @Patch(":id/publish")
  @ApiParam({ name: "id", description: "Legal policy version UUID" })
  @ApiOperation({
    summary: "Publish a legal policy version (RBAC: legal.admin write)",
    description:
      "Once published, learners will be required to consent to the new version. Gated actions checked via LegalConsentService."
  })
  async publish(@Req() req: Request, @Param("id", ParseUUIDPipe) id: string) {
    await this.adminAuth.requireOneOfPermissions(req, LEGAL_ADMIN_PERMS);
    return this.legalPolicyAdmin.publishPolicy(id);
  }

  @Patch(":id/archive")
  @ApiParam({ name: "id", description: "Legal policy version UUID" })
  @ApiOperation({ summary: "Archive a legal policy version (RBAC: legal.admin write)" })
  async archive(@Req() req: Request, @Param("id", ParseUUIDPipe) id: string) {
    await this.adminAuth.requireOneOfPermissions(req, LEGAL_ADMIN_PERMS);
    return this.legalPolicyAdmin.archivePolicy(id);
  }
}
