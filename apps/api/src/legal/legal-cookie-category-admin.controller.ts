import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";

const LEGAL_READ_PERMS = ["admin.legal.read", "admin.legal.write", "legal.admin", "viewer.audit"];

/**
 * Curated cookie/tracker category list.
 *
 * partial_schema_pending: no `cookie_category` table yet. This list is the
 * code-owned source of truth and is mirrored in the user cookie banner. Once
 * schema lands we will move to CRUD with audit. See
 * company/admin-module-inventory.md (lg.cookies).
 */
const COOKIE_CATEGORIES = [
  {
    key: "essential",
    name: "Essential",
    description:
      "Cookies required for authentication, security, fraud prevention, and core platform functionality.",
    optInDefault: true,
    canOptOut: false,
    dataCollected: ["session id", "csrf token", "auth state"],
    retentionDays: 30,
    thirdParties: []
  },
  {
    key: "functional",
    name: "Functional",
    description:
      "Cookies that remember learner preferences (locale, theme, onboarding state).",
    optInDefault: true,
    canOptOut: true,
    dataCollected: ["preferred locale", "ui preferences", "onboarding flags"],
    retentionDays: 365,
    thirdParties: []
  },
  {
    key: "analytics",
    name: "Analytics",
    description:
      "Aggregated usage telemetry to improve the product. No personal identifiers shared with third parties.",
    optInDefault: false,
    canOptOut: true,
    dataCollected: ["page views", "feature events", "performance metrics"],
    retentionDays: 180,
    thirdParties: ["self-hosted analytics"]
  },
  {
    key: "marketing",
    name: "Marketing",
    description:
      "Cookies used for measuring campaign effectiveness. Disabled by default in EU/JP.",
    optInDefault: false,
    canOptOut: true,
    dataCollected: ["campaign attribution", "conversion events"],
    retentionDays: 90,
    thirdParties: ["payment provider attribution"]
  }
];

@Controller("admin/legal/cookie-categories")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("legal")
@LogAdminAction({ resourceType: "admin.legal_cookie_category" })
@ApiTags("Admin", "Legal")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class LegalCookieCategoryAdminController {
  constructor(private readonly auth: AdminAuthService) {}

  @Get()
  @ApiOperation({ summary: "List curated cookie/tracker categories." })
  @ApiOkResponse({ description: "Curated cookie category list." })
  async list(@Req() req: Request) {
    await this.auth.requireOneOfPermissions(req, LEGAL_READ_PERMS);
    return {
      items: COOKIE_CATEGORIES,
      total: COOKIE_CATEGORIES.length,
      partialSchemaPending: true,
      note:
        "Cookie categories are code-owned today; CRUD lands once cookie_category table is added."
    };
  }
}
