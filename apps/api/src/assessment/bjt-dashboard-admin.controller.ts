import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";

import { BjtDashboardAdminRepository } from "./bjt-dashboard-admin.repository.js";

const READ_PERMS = [
  "analytics.view",
  "admin.analytics.view",
  "viewer.analytics",
  "viewer.audit",
  "assessment.manage",
  "assessment.review"
] as const;

@Controller("admin/bjt")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("analytics")
@LogAdminAction({ resourceType: "assessment.bjt_dashboard" })
@ApiTags("Admin Assessment", "BJT Dashboard")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class BjtDashboardAdminController {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(BjtDashboardAdminRepository) private readonly repo: BjtDashboardAdminRepository
  ) {}

  @Get("summary")
  @ApiOperation({
    summary:
      "Read-only BJT overview dashboard: learners by level, mock-exam KPIs, pass rate (30d, weekly), top topics, upcoming exams, drop-offs."
  })
  @ApiOkResponse({ description: "BJT admin overview summary." })
  async summary(@Req() req: Request) {
    await this.auth.requireOneOfPermissions(req, READ_PERMS);
    return this.repo.summary();
  }
}
