import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
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
  rules: z.record(z.string(), z.unknown()).optional()
});

const resolveDeadLetterSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
  status: z.enum(["resolved", "discarded"])
});

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
  async deadLetters(@Req() req: Request, @Query("status") status?: string) {
    await this.adminAuth.requireOneOfPermissions(req, ["viewer.audit", "iam.manage"]);
    return this.ops.listDeadLetters(status);
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
    return this.ops.rebuildSearchProjection({ actorId: principal.actorId, reason: parsed.data.reason });
  }
}
