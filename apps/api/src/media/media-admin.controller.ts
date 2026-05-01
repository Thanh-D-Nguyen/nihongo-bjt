import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { Request } from "express";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { MediaService } from "./media.service.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  mimeType: z.string().trim().min(1).max(64).optional(),
  offset: z.coerce.number().int().min(0).optional().default(0),
  rightsStatus: z.string().trim().min(1).max(32).optional(),
  status: z.string().trim().min(1).max(32).optional(),
  q: z.string().trim().min(1).max(200).optional()
});

const updateMetadataSchema = z.object({
  license: z.string().trim().min(1).max(120).optional(),
  rightsStatus: z.enum(["pending_review", "cleared", "blocked"]).optional(),
  sourceUrl: z.string().trim().max(2048).nullable().optional(),
  provenance: z.record(z.string(), z.unknown()).nullable().optional(),
  accessibility: z.record(z.string(), z.unknown()).nullable().optional(),
  reason: z.string().trim().min(3).max(1000)
});

const softDeleteSchema = z.object({
  reason: z.string().trim().min(3).max(1000)
});

const MEDIA_WRITE_PERMS = ["media.manage", "content.manage", "iam.manage"];

@Controller("admin/media")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("media")
@LogAdminAction({ resourceType: "admin.media" })
@ApiTags("Admin Media")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class MediaAdminController {
  constructor(
    @Inject(AdminAuthService) private readonly adminAuth: AdminAuthService,
    @Inject(MediaService) private readonly mediaService: MediaService
  ) {}

  @Get()
  @ApiOperation({ summary: "List media assets with pagination and optional filters." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiQuery({ name: "rightsStatus", required: false, schema: { type: "string" } })
  @ApiQuery({ name: "mimeType", required: false, schema: { type: "string" } })
  @ApiQuery({ name: "status", required: false, schema: { type: "string" } })
  @ApiQuery({ name: "q", required: false, schema: { type: "string" } })
  @ApiOkResponse({ description: "Paginated list of media assets." })
  async list(@Req() req: Request, @Query() query: Record<string, unknown>) {
    await this.adminAuth.requireOneOfPermissions(req, [...MEDIA_WRITE_PERMS, "viewer.audit"]);
    const parsed = listQuerySchema.parse(query);
    if (parsed.q) {
      return this.mediaService.adminSearchAssets({ ...parsed, q: parsed.q });
    }
    return this.mediaService.adminListAssets(parsed);
  }

  @Get(":id")
  @ApiOperation({ summary: "Detail of a media asset including provenance, license, content references." })
  @ApiParam({ name: "id" })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.adminAuth.requireOneOfPermissions(req, [...MEDIA_WRITE_PERMS, "viewer.audit"]);
    return this.mediaService.adminGetAssetDetail(id);
  }

  @Patch(":id/metadata")
  @ApiOperation({ summary: "Replace media metadata (license/provenance/accessibility/rightsStatus). Audit reason required." })
  @ApiParam({ name: "id" })
  @ApiBody({ description: "Zod: { license?, rightsStatus?, sourceUrl?, provenance?, accessibility?, reason }" })
  async updateMetadata(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, MEDIA_WRITE_PERMS);
    const parsed = updateMetadataSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.mediaService.adminUpdateMetadata({
      accessibility: parsed.data.accessibility ?? undefined,
      actorId: principal.actorId,
      id,
      license: parsed.data.license,
      provenance: parsed.data.provenance ?? undefined,
      reason: parsed.data.reason,
      rightsStatus: parsed.data.rightsStatus,
      sourceUrl: parsed.data.sourceUrl ?? undefined
    });
  }

  @Delete(":id")
  @ApiOperation({ summary: "Soft-delete a media asset (status='deleted'); audit reason required." })
  @ApiParam({ name: "id" })
  async softDelete(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, MEDIA_WRITE_PERMS);
    const parsed = softDeleteSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.mediaService.adminSoftDeleteAsset({
      actorId: principal.actorId,
      id,
      reason: parsed.data.reason
    });
  }
}
