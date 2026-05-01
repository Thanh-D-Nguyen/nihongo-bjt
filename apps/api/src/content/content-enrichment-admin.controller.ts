import {
  adminContentEnrichmentBulkRetrySchema,
  adminContentEnrichmentListQuerySchema,
  adminContentEnrichmentReasonBodySchema
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

import { ContentEnrichmentAdminRepository } from "./content-enrichment-admin.repository.js";

/**
 * Admin enrichment-job queue: list/detail with provenance, retry/cancel, bulk retry.
 *
 * Provider provenance + license fields are exposed to operators (AGENTS.md non-negotiable). Audit
 * codes: `admin.content.enrichment.{retried|cancelled|bulk_retried}`.
 */
@Controller("admin/content/enrichment")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("content")
@LogAdminAction({ resourceType: "content.enrichment" })
@ApiTags("Admin Content", "Enrichment")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class ContentEnrichmentAdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly repo: ContentEnrichmentAdminRepository
  ) {}

  @Get()
  @ApiOperation({ summary: "List enrichment jobs (filters: q, status, type, entityType, entityId, provider, from, to). Pagination 25/page." })
  async list(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.write",
      "admin.content.read",
      "viewer.audit"
    ]);
    const parsed = adminContentEnrichmentListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.list(parsed.data);
  }

  @Get(":id")
  @ApiOperation({ summary: "Detail of an enrichment job (input/output snapshot, provenance, retry history, audit)." })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.write",
      "admin.content.read",
      "viewer.audit"
    ]);
    const found = await this.repo.detail(id);
    if (!found) throw new BadRequestException({ code: "enrichment_job_not_found", id });
    return found;
  }

  @Post(":id/retry")
  @ApiOperation({ summary: "Retry a failed/cancelled enrichment job. Re-queues with attempt history. Audited." })
  async retry(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminContentEnrichmentReasonBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.retry(principal.actorId, id, parsed.data.reason);
  }

  @Post(":id/cancel")
  @ApiOperation({ summary: "Cancel a queued or running enrichment job. Audited." })
  async cancel(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminContentEnrichmentReasonBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.cancel(principal.actorId, id, parsed.data.reason);
  }

  @Post("bulk-retry")
  @ApiOperation({ summary: "Bulk-retry a list of jobIds. Body { jobIds: string[], reason }. Audited per-job." })
  async bulkRetry(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminContentEnrichmentBulkRetrySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.bulkRetry(principal.actorId, parsed.data.jobIds, parsed.data.reason);
  }
}
