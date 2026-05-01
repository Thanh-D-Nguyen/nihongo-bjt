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
 * Curated data-retention domains exposed to admins.
 *
 * partial_schema_pending: there is no `retention_policy` table yet. This
 * endpoint returns a static, code-owned list documenting each domain's
 * retention period and runner. Mutations are intentionally not exposed here:
 * changing retention windows requires a code/migration change today, plus
 * operator scheduling. Once schema lands we will add CRUD + scheduler
 * controls. See company/admin-module-inventory.md (lg.ret).
 */
const RETENTION_DOMAINS = [
  {
    domain: "users",
    label: "Inactive accounts",
    description:
      "Anonymise accounts after sustained inactivity. Personal identifiers removed; learning aggregates retained.",
    retentionDays: 730,
    gracePeriodDays: 30,
    runner: "scripts/retention/anonymize-inactive.ts",
    schedule: "weekly",
    irreversible: true
  },
  {
    domain: "battle.sessions",
    label: "Battle session logs",
    description:
      "Anonymise per-session telemetry; retains aggregate counters for analytics.",
    retentionDays: 90,
    gracePeriodDays: 0,
    runner: "scripts/retention/anonymize-battle.ts",
    schedule: "daily",
    irreversible: true
  },
  {
    domain: "messages",
    label: "Battle/chat messages",
    description:
      "Hard-delete chat messages older than retention window. No recovery once purged.",
    retentionDays: 30,
    gracePeriodDays: 0,
    runner: "scripts/retention/purge-messages.ts",
    schedule: "daily",
    irreversible: true
  },
  {
    domain: "auth.sessions",
    label: "Auth/session tokens",
    description:
      "Expire and purge auth/session records and refresh tokens after retention window.",
    retentionDays: 30,
    gracePeriodDays: 0,
    runner: "scripts/retention/purge-sessions.ts",
    schedule: "daily",
    irreversible: true
  },
  {
    domain: "logs.audit",
    label: "Admin audit log",
    description:
      "Audit logs are retained for compliance. No automated purge — archival exports only.",
    retentionDays: 1825,
    gracePeriodDays: 0,
    runner: "scripts/retention/audit-archival-export.ts",
    schedule: "monthly",
    irreversible: false
  },
  {
    domain: "logs.events",
    label: "Analytics events",
    description:
      "Raw event rows; analytics rollups are retained separately. Hard-delete after window.",
    retentionDays: 180,
    gracePeriodDays: 0,
    runner: "scripts/retention/purge-events.ts",
    schedule: "weekly",
    irreversible: true
  },
  {
    domain: "privacy.requests",
    label: "Privacy data-subject requests",
    description:
      "Completed privacy requests are retained for compliance evidence. No automated purge.",
    retentionDays: 1825,
    gracePeriodDays: 0,
    runner: "n/a",
    schedule: "n/a",
    irreversible: false
  }
];

@Controller("admin/legal/retention")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("legal")
@LogAdminAction({ resourceType: "admin.legal_retention" })
@ApiTags("Admin", "Legal")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class LegalRetentionAdminController {
  constructor(private readonly auth: AdminAuthService) {}

  @Get()
  @ApiOperation({
    summary:
      "List curated data-retention domains with retention windows, grace periods, runners and schedule."
  })
  @ApiOkResponse({ description: "Curated retention policy summary." })
  async list(@Req() req: Request) {
    await this.auth.requireOneOfPermissions(req, LEGAL_READ_PERMS);
    return {
      items: RETENTION_DOMAINS,
      total: RETENTION_DOMAINS.length,
      partialSchemaPending: true,
      note:
        "Mutations require a schema migration (retention_policy table) plus operator scheduling. Edit retention windows via code+migration today."
    };
  }
}
