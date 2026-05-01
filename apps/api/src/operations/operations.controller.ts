import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { Request } from "express";
import type { Prisma } from "@nihongo-bjt/database";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import {
  DeadLetterEntryOpenApiDto,
  FeatureFlagOpenApiDto,
  ImportStagingErrorOpenApiDto,
  SearchRebuildSummaryOpenApiDto
} from "../openapi/dto/backend-api-openapi.dto.js";
import { OperationsService } from "./operations.service.js";

const updateFlagSchema = z.object({
  enabled: z.boolean().optional(),
  killSwitch: z.boolean().optional(),
  reason: z.string().trim().min(3).max(1000),
  rules: z.record(z.string(), z.unknown()).optional(),
  confirmation: z.string().trim().max(255).optional()
});

/**
 * Patterns that mark a feature flag / setting as "high-risk": billing, monetization, auth,
 * rate-limit, kill-switch, security. Any write to a matching key MUST include
 * `confirmation === key` in the request body. Centralised so admin UI + tests stay in sync.
 */
export const HIGH_RISK_FLAG_KEY_PATTERNS: readonly RegExp[] = [
  /^monetization\./i,
  /^billing\./i,
  /^auth\./i,
  /^security\./i,
  /rate[_.-]?limit/i,
  /kill[_.-]?switch/i
];

export function isHighRiskFlagKey(key: string, killSwitch?: boolean): boolean {
  if (killSwitch === true) return true;
  return HIGH_RISK_FLAG_KEY_PATTERNS.some((re) => re.test(key));
}

const resolveDeadLetterSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
  status: z.enum(["resolved", "discarded"])
});

const retryDeadLetterSchema = z.object({
  reason: z.string().trim().min(3).max(1000)
});

const bulkDeadLetterSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum(["retry", "discard"]),
  reason: z.string().trim().min(3).max(1000)
});

const deadLettersQuerySchema = z.object({
  status: z.string().trim().min(1).max(32).optional(),
  queueName: z.string().trim().min(1).max(120).optional(),
  source: z.string().trim().min(1).max(120).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0)
});

const securityEventsQuerySchema = z.object({
  type: z.string().trim().min(1).max(64).optional(),
  severity: z.string().trim().min(1).max(16).optional(),
  actorId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0)
});

const securityResolveSchema = z.object({
  resolution: z.enum(["resolved", "false_positive"]),
  reason: z.string().trim().min(3).max(1000)
});

const broadcastsQuerySchema = z.object({
  status: z.enum(["draft", "scheduled", "sent", "cancelled"]).optional(),
  channel: z.enum(["push", "email", "in_app"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0)
});

const audienceSchema = z
  .object({
    locale: z.array(z.string().min(1).max(8)).max(20).optional(),
    plan: z.array(z.string().min(1).max(64)).max(20).optional(),
    level: z.array(z.string().min(1).max(16)).max(20).optional(),
    country: z.array(z.string().min(1).max(8)).max(20).optional(),
    userIds: z.array(z.string().uuid()).max(2000).optional()
  })
  .strict();

const broadcastCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
  channel: z.enum(["push", "email", "in_app"]),
  audience: audienceSchema,
  scheduledAt: z.string().datetime().optional(),
  reason: z.string().trim().min(3).max(1000)
});

const broadcastUpdateSchema = broadcastCreateSchema
  .partial()
  .extend({ reason: z.string().trim().min(3).max(1000) });

const broadcastTransitionSchema = z.object({
  reason: z.string().trim().min(3).max(1000)
});

// ── Sweep C schemas ──────────────────────────────────────────────────────
const queueTransitionSchema = z.object({
  queueName: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(3).max(1000),
  confirmation: z.string().trim().max(255).optional()
});

const releaseMarkSchema = z.object({
  version: z.string().trim().min(1).max(255),
  reason: z.string().trim().min(3).max(1000),
  confirmation: z.string().trim().min(1).max(255)
});

const releaseRollbackSchema = z.object({
  targetVersion: z.string().trim().min(1).max(255),
  reason: z.string().trim().min(3).max(1000),
  confirmation: z.string().trim().min(1).max(255)
});

const partialReindexSchema = z.object({
  contentType: z.enum(["lexeme", "kanji", "grammar", "example"]),
  reason: z.string().trim().min(3).max(1000)
});

const importErrorRetrySchema = z.object({ reason: z.string().trim().min(3).max(1000) });
const importErrorBulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum(["retry", "discard"]),
  reason: z.string().trim().min(3).max(1000)
});

const manifestCreateSchema = z.object({
  sourceType: z.string().trim().min(1).max(64),
  targetType: z.string().trim().min(1).max(64),
  version: z.coerce.number().int().min(1).optional(),
  mapping: z.record(z.string(), z.unknown()),
  notes: z.string().trim().max(2000).optional(),
  reason: z.string().trim().min(3).max(1000)
});

const manifestUpdateSchema = z.object({
  mapping: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  reason: z.string().trim().min(3).max(1000)
});

const manifestRunSchema = z.object({ reason: z.string().trim().min(3).max(1000) });

const importStagingErrorsQuerySchema = z.object({
  batchId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  phase: z.string().trim().min(1).max(32).optional(),
  severity: z.string().trim().min(1).max(16).optional()
});

const escalateImportErrorSchema = z.object({
  reason: z.string().trim().min(3).max(1000)
});

const importBatchesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  status: z.string().trim().min(1).max(32).optional()
});

const rebuildSearchProjectionSchema = z.object({
  confirmation: z.string().trim().min(1).max(120).optional(),
  reason: z.string().trim().min(3).max(1000)
});

@Controller("admin/operations")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("operations")
@LogAdminAction({ resourceType: "admin.operations" })
@ApiTags("Operations")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class OperationsController {
  constructor(
    @Inject(AdminAuthService) private readonly adminAuth: AdminAuthService,
    @Inject(OperationsService) private readonly ops: OperationsService
  ) {}

  @Get("feature-flags")
  @ApiOperation({ summary: "List persisted feature flags and kill switches." })
  @ApiOkResponse({ type: FeatureFlagOpenApiDto, isArray: true })
  async listFlags(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, ["iam.manage", "viewer.audit"]);
    return this.ops.listFeatureFlags();
  }

  @Get("system/health")
  @ApiOperation({ summary: "System health summary for admin operations console." })
  async systemHealth(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, ["iam.manage", "viewer.audit"]);
    return this.ops.systemHealthSummary();
  }

  @Get("system/queue-health")
  @ApiOperation({ summary: "Queue and dead-letter health summary for admin operations console." })
  async queueHealth(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, ["iam.manage", "viewer.audit"]);
    return this.ops.queueHealthSummary();
  }

  @Get("system/search-sync")
  @ApiOperation({ summary: "Search projection sync status and latest rebuild metadata." })
  async searchSync(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, ["iam.manage", "viewer.audit"]);
    return this.ops.searchSyncSummary();
  }

  @Get("system/release")
  @ApiOperation({ summary: "Release/build metadata for admin operations console." })
  async releaseSummary(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, ["iam.manage", "viewer.audit"]);
    return this.ops.releaseSummary();
  }

  @Patch("feature-flags/:key")
  @ApiOperation({ summary: "Update a feature flag. Requires audit reason." })
  @ApiParam({ name: "key" })
  @ApiBody({ description: "Zod: { enabled?, killSwitch?, rules?, reason }" })
  @ApiOkResponse({ type: FeatureFlagOpenApiDto })
  async updateFlag(@Req() req: Request, @Param("key") key: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = updateFlagSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if (isHighRiskFlagKey(key, parsed.data.killSwitch) && parsed.data.confirmation !== key) {
      throw new BadRequestException({
        code: "high_risk_confirmation_required",
        key,
        message: "High-risk setting changes require confirmation field === key."
      });
    }
    return this.ops.updateFeatureFlag({
      actorId: principal.actorId,
      enabled: parsed.data.enabled,
      key,
      killSwitch: parsed.data.killSwitch,
      reason: parsed.data.reason,
      rules: parsed.data.rules as Prisma.InputJsonValue | undefined
    });
  }

  @Get("kill-switches")
  @ApiOperation({ summary: "List feature flags marked as module-level kill switches." })
  @ApiOkResponse({ type: FeatureFlagOpenApiDto, isArray: true })
  async killSwitches(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, ["iam.manage", "viewer.audit"]);
    const flags = await this.ops.listFeatureFlags();
    return flags.filter((flag) => flag.killSwitch);
  }

  @Patch("kill-switches/:key")
  @ApiOperation({ summary: "Update a module-level kill switch. Requires audit reason." })
  @ApiParam({ name: "key" })
  @ApiOkResponse({ type: FeatureFlagOpenApiDto })
  async updateKillSwitch(@Req() req: Request, @Param("key") key: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = updateFlagSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    // kill switches are always high-risk
    if (parsed.data.confirmation !== key) {
      throw new BadRequestException({
        code: "high_risk_confirmation_required",
        key,
        message: "Kill-switch changes require confirmation field === key."
      });
    }
    return this.ops.updateFeatureFlag({
      actorId: principal.actorId,
      enabled: parsed.data.enabled,
      key,
      killSwitch: true,
      reason: parsed.data.reason,
      rules: parsed.data.rules as Prisma.InputJsonValue | undefined
    });
  }

  @Get("dead-letter-queue")
  @ApiOperation({ summary: "List dead-letter entries for failed jobs/events." })
  @ApiOkResponse({ type: DeadLetterEntryOpenApiDto, isArray: true })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "queueName", required: false })
  @ApiQuery({ name: "source", required: false })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "offset", required: false })
  async deadLetters(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage"]);
    const parsed = deadLettersQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.listDeadLettersFiltered(parsed.data);
  }

  @Get("dead-letter-queue/:id")
  @ApiOperation({ summary: "Detail of a dead-letter entry, including payload, error trace, and audit history." })
  @ApiParam({ name: "id" })
  async deadLetterDetail(@Req() req: Request, @Param("id") id: string) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage"]);
    return this.ops.getDeadLetterDetail(id);
  }

  @Patch("dead-letter-queue/:id/retry")
  @ApiOperation({ summary: "Re-enqueue a dead-letter entry for retry. Requires audit reason." })
  @ApiParam({ name: "id" })
  async retryDeadLetter(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = retryDeadLetterSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.retryDeadLetter({ actorId: principal.actorId, id, reason: parsed.data.reason });
  }

  @Patch("dead-letter-queue/bulk")
  @ApiOperation({ summary: "Bulk retry or discard dead-letter entries. Requires audit reason." })
  @ApiBody({ description: "Zod: { ids, action: 'retry'|'discard', reason }" })
  async bulkDeadLetter(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = bulkDeadLetterSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.bulkDeadLetter({
      actorId: principal.actorId,
      action: parsed.data.action,
      ids: parsed.data.ids,
      reason: parsed.data.reason
    });
  }

  @Get("notifications")
  @ApiOperation({ summary: "Operational notifications status summary from dead-letter/import signals." })
  async notificationsSummary(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage"]);
    return this.ops.notificationsSummary();
  }

  @Get("security")
  @ApiOperation({ summary: "Security posture summary for IAM and operations audit health." })
  async securitySummary(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage"]);
    return this.ops.securitySummary();
  }

  @Patch("dead-letter-queue/:id")
  @ApiOperation({ summary: "Resolve or discard a dead-letter entry. Requires audit reason." })
  @ApiParam({ name: "id" })
  async resolveDeadLetter(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = resolveDeadLetterSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.resolveDeadLetter({ actorId: principal.actorId, id, ...parsed.data });
  }

  @Get("import-staging/errors")
  @ApiOperation({ summary: "List staged import errors with batch/raw-item context for admin triage." })
  @ApiOkResponse({ type: ImportStagingErrorOpenApiDto, isArray: true })
  @ApiQuery({ name: "batchId", required: false })
  @ApiQuery({ name: "phase", required: false })
  @ApiQuery({ name: "severity", required: false })
  @ApiQuery({ name: "limit", required: false, example: 50 })
  async importStagingErrors(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage"]);
    const parsed = importStagingErrorsQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.listImportStagingErrors(parsed.data);
  }

  @Get("import-batches")
  @ApiOperation({ summary: "List content import batches with pagination." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiQuery({ name: "status", required: false, schema: { type: "string" } })
  async importBatches(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage"]);
    const parsed = importBatchesQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.listImportBatches(parsed.data);
  }

  @Get("import-manifests")
  @ApiOperation({ summary: "List content import mapping manifests with pagination." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiQuery({ name: "status", required: false, schema: { type: "string" } })
  async importManifests(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage"]);
    const parsed = importBatchesQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.listImportManifests(parsed.data);
  }

  @Patch("import-staging/errors/:id/dead-letter")
  @ApiOperation({ summary: "Escalate an import staging error into the operational dead-letter queue." })
  @ApiParam({ name: "id" })
  @ApiBody({ description: "Zod: { reason }" })
  @ApiOkResponse({ type: DeadLetterEntryOpenApiDto })
  async escalateImportErrorToDeadLetter(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = escalateImportErrorSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.escalateImportErrorToDeadLetter({ actorId: principal.actorId, id, reason: parsed.data.reason });
  }

  @Patch("search-rebuild")
  @ApiOperation({ summary: "Rebuild the Meilisearch content projection from canonical PostgreSQL content tables." })
  @ApiBody({ description: "Zod: { reason }" })
  @ApiOkResponse({ type: SearchRebuildSummaryOpenApiDto })
  async rebuildSearchProjection(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = rebuildSearchProjectionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if (parsed.data.confirmation !== "rebuild-search-projection") {
      throw new BadRequestException("confirmation must equal 'rebuild-search-projection'");
    }
    return this.ops.rebuildSearchProjection({ actorId: principal.actorId, reason: parsed.data.reason });
  }

  @Get("feature-flags/:key/history")
  @ApiOperation({ summary: "Audit history for a single feature flag (or kill switch)." })
  @ApiParam({ name: "key" })
  @ApiQuery({ name: "limit", required: false })
  async featureFlagHistory(
    @Req() req: Request,
    @Param("key") key: string,
    @Query("limit") limit: string | undefined
  ) {
    await this.adminAuth.requireOneOfPermissions(req, ["iam.manage", "viewer.audit"]);
    const parsedLimit = Math.min(Math.max(Number(limit ?? 50), 1), 200);
    return this.ops.featureFlagHistory({ key, limit: parsedLimit });
  }

  @Get("security/events")
  @ApiOperation({
    summary:
      "Security event timeline derived from admin audit log. Filters: type (failed_login | permission_denied | suspicious_request | rate_limit_exceeded | privilege_escalation_attempt), severity, dateRange, actorId."
  })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "severity", required: false })
  @ApiQuery({ name: "actorId", required: false })
  @ApiQuery({ name: "dateFrom", required: false })
  @ApiQuery({ name: "dateTo", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "offset", required: false })
  async securityEvents(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage"]);
    const parsed = securityEventsQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.listSecurityEvents(parsed.data);
  }

  @Get("security/events/:id")
  @ApiOperation({ summary: "Detail of a security event including resolution audit trail." })
  @ApiParam({ name: "id" })
  async securityEventDetail(@Req() req: Request, @Param("id") id: string) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage"]);
    return this.ops.getSecurityEventDetail(id);
  }

  @Patch("security/events/:id/resolve")
  @ApiOperation({ summary: "Mark a security event as resolved or false-positive. Requires audit reason." })
  @ApiParam({ name: "id" })
  @ApiBody({ description: "Zod: { resolution: 'resolved'|'false_positive', reason }" })
  async resolveSecurityEvent(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = securityResolveSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.resolveSecurityEvent({
      actorId: principal.actorId,
      id,
      reason: parsed.data.reason,
      resolution: parsed.data.resolution
    });
  }

  @Get("broadcasts")
  @ApiOperation({
    summary:
      "List broadcast notifications (drafts/scheduled/sent/cancelled). partial_schema_pending: persisted via admin_audit_log with targetType=ops.broadcast until BroadcastNotification model lands."
  })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "channel", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "offset", required: false })
  async listBroadcasts(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage"]);
    const parsed = broadcastsQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.listBroadcasts(parsed.data);
  }

  @Get("broadcasts/:id")
  @ApiOperation({ summary: "Detail of a broadcast notification with audit history." })
  @ApiParam({ name: "id" })
  async broadcastDetail(@Req() req: Request, @Param("id") id: string) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage"]);
    return this.ops.getBroadcastDetail(id);
  }

  @Patch("broadcasts/audience/estimate")
  @ApiOperation({ summary: "Estimate audience size for a broadcast filter." })
  async estimateAudience(@Req() req: Request, @Body() body: unknown) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage"]);
    const parsed = audienceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.estimateBroadcastAudience(parsed.data);
  }

  @Patch("broadcasts")
  @ApiOperation({ summary: "Create a broadcast notification draft. Requires audit reason." })
  async createBroadcast(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = broadcastCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.createBroadcast({ actorId: principal.actorId, ...parsed.data });
  }

  @Patch("broadcasts/:id")
  @ApiOperation({ summary: "Update a broadcast notification draft. Requires audit reason." })
  @ApiParam({ name: "id" })
  async updateBroadcast(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = broadcastUpdateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.updateBroadcast({ actorId: principal.actorId, id, ...parsed.data });
  }

  @Patch("broadcasts/:id/schedule")
  @ApiOperation({ summary: "Schedule a draft broadcast notification. Requires audit reason." })
  @ApiParam({ name: "id" })
  async scheduleBroadcast(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = broadcastTransitionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.transitionBroadcast({ actorId: principal.actorId, id, reason: parsed.data.reason, to: "scheduled" });
  }

  @Patch("broadcasts/:id/cancel")
  @ApiOperation({ summary: "Cancel a draft or scheduled broadcast. Requires audit reason." })
  @ApiParam({ name: "id" })
  async cancelBroadcast(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = broadcastTransitionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.transitionBroadcast({ actorId: principal.actorId, id, reason: parsed.data.reason, to: "cancelled" });
  }

  // ── Sweep C: queue actions ────────────────────────────────────────────
  @Get("system/queue-health/actions")
  @ApiOperation({ summary: "Recent queue pause/resume/drain audit history." })
  @ApiQuery({ name: "queueName", required: false })
  @ApiQuery({ name: "limit", required: false })
  async queueActions(
    @Req() req: Request,
    @Query("queueName") queueName?: string,
    @Query("limit") limit?: string
  ) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage"]);
    const parsedLimit = Math.min(Math.max(Number(limit ?? 50), 1), 200);
    return this.ops.listQueueActions({ queueName, limit: parsedLimit });
  }

  @Post("system/queue-health/pause")
  @HttpCode(200)
  @ApiOperation({ summary: "Pause a queue (sets queue.<name>.paused=true and audits)." })
  async pauseQueue(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = queueTransitionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.transitionQueue({ actorId: principal.actorId, action: "pause", ...parsed.data });
  }

  @Post("system/queue-health/resume")
  @HttpCode(200)
  @ApiOperation({ summary: "Resume a paused queue." })
  async resumeQueue(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = queueTransitionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.transitionQueue({ actorId: principal.actorId, action: "resume", ...parsed.data });
  }

  @Post("system/queue-health/drain")
  @HttpCode(200)
  @ApiOperation({ summary: "Drain a queue (typed-confirmation === queueName; audit-only)." })
  async drainQueue(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = queueTransitionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if (parsed.data.confirmation !== parsed.data.queueName) {
      throw new BadRequestException("confirmation must equal queueName");
    }
    return this.ops.transitionQueue({ actorId: principal.actorId, action: "drain", ...parsed.data });
  }

  // ── Sweep C: partial reindex ──────────────────────────────────────────
  @Post("search-rebuild/partial")
  @HttpCode(200)
  @ApiOperation({ summary: "Partial search reindex by contentType (audited; uses full rebuild until incremental indexer lands)." })
  async partialReindex(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = partialReindexSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.partialReindex({ actorId: principal.actorId, ...parsed.data });
  }

  // ── Sweep C: release management ───────────────────────────────────────
  @Get("system/release/history")
  @ApiOperation({ summary: "Release event history (mark-known-good / prepare-rollback audit timeline)." })
  @ApiQuery({ name: "limit", required: false })
  async releaseHistory(@Req() req: Request, @Query("limit") limit?: string) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage"]);
    const parsedLimit = Math.min(Math.max(Number(limit ?? 50), 1), 200);
    return this.ops.listReleaseEvents({ limit: parsedLimit });
  }

  @Post("system/release/mark-known-good")
  @HttpCode(200)
  @ApiOperation({ summary: "Mark current release as known-good (typed-confirmation === version; audit-only)." })
  async markReleaseKnownGood(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = releaseMarkSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if (parsed.data.confirmation !== parsed.data.version) {
      throw new BadRequestException("confirmation must equal version");
    }
    return this.ops.markReleaseKnownGood({ actorId: principal.actorId, ...parsed.data });
  }

  @Post("system/release/prepare-rollback")
  @HttpCode(200)
  @ApiOperation({ summary: "Prepare rollback ticket (typed-confirmation === targetVersion; audit-only)." })
  async prepareRollback(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = releaseRollbackSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    if (parsed.data.confirmation !== parsed.data.targetVersion) {
      throw new BadRequestException("confirmation must equal targetVersion");
    }
    return this.ops.prepareRollback({ actorId: principal.actorId, ...parsed.data });
  }

  // ── Sweep C: import errors retry/discard/bulk ─────────────────────────
  @Patch("import-staging/errors/:id/retry")
  @ApiOperation({ summary: "Retry an import staging error (re-queue request; audited)." })
  @ApiParam({ name: "id" })
  async retryImportError(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = importErrorRetrySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.retryImportError({ actorId: principal.actorId, id, reason: parsed.data.reason });
  }

  @Patch("import-staging/errors/:id/discard")
  @ApiOperation({ summary: "Discard an import staging error (audited)." })
  @ApiParam({ name: "id" })
  async discardImportError(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = importErrorRetrySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.discardImportError({ actorId: principal.actorId, id, reason: parsed.data.reason });
  }

  @Patch("import-staging/errors/bulk")
  @ApiOperation({ summary: "Bulk retry or discard import staging errors. Requires audit reason." })
  async bulkImportErrorAction(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = importErrorBulkSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.bulkImportErrorAction({ actorId: principal.actorId, ...parsed.data });
  }

  // ── Sweep C: import manifests CRUD + run + history ────────────────────
  @Get("import-manifests/:id")
  @ApiOperation({ summary: "Detail of an import manifest with audit/run history." })
  @ApiParam({ name: "id" })
  async importManifestDetail(@Req() req: Request, @Param("id") id: string) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage"]);
    return this.ops.getImportManifestDetail(id);
  }

  @Post("import-manifests")
  @HttpCode(201)
  @ApiOperation({ summary: "Create an import manifest. Requires audit reason." })
  async createImportManifest(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = manifestCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.createImportManifest({
      actorId: principal.actorId,
      mapping: parsed.data.mapping as Prisma.InputJsonValue,
      notes: parsed.data.notes,
      reason: parsed.data.reason,
      sourceType: parsed.data.sourceType,
      targetType: parsed.data.targetType,
      version: parsed.data.version
    });
  }

  @Patch("import-manifests/:id")
  @ApiOperation({ summary: "Update import manifest fields/status. Requires audit reason." })
  @ApiParam({ name: "id" })
  async updateImportManifest(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = manifestUpdateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.updateImportManifest({
      actorId: principal.actorId,
      id,
      mapping: parsed.data.mapping as Prisma.InputJsonValue | undefined,
      notes: parsed.data.notes ?? undefined,
      reason: parsed.data.reason,
      status: parsed.data.status
    });
  }

  @Post("import-manifests/:id/run")
  @HttpCode(200)
  @ApiOperation({ summary: "Trigger a run of an active manifest (audited; pipeline runs async)." })
  @ApiParam({ name: "id" })
  async runImportManifest(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "iam.manage");
    const parsed = manifestRunSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.ops.runImportManifest({ actorId: principal.actorId, id, reason: parsed.data.reason });
  }

  @Get("import-manifests/:id/history")
  @ApiOperation({ summary: "Run history for a single manifest." })
  @ApiParam({ name: "id" })
  @ApiQuery({ name: "limit", required: false })
  async importManifestHistory(
    @Req() req: Request,
    @Param("id") id: string,
    @Query("limit") limit?: string
  ) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage"]);
    const parsedLimit = Math.min(Math.max(Number(limit ?? 50), 1), 200);
    return this.ops.manifestRunHistory({ id, limit: parsedLimit });
  }

  // ── Sweep C: import overview & BJT dashboard ──────────────────────────
  @Get("import/overview")
  @ApiOperation({ summary: "Aggregated import dashboard (pending/in-progress/24h success/failure)." })
  async importOverview(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage"]);
    return this.ops.importOverview();
  }

  @Get("bjt/dashboard")
  @ApiOperation({ summary: "BJT learning dashboard summary (tests, sessions, attempts, by-level)." })
  async bjtDashboard(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage", "viewer.analytics"]);
    return this.ops.bjtDashboard();
  }
}
