import {
  adminContentVersionDiffQuerySchema,
  adminContentVersionListQuerySchema,
  adminContentVersionRevertBodySchema
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

import { ContentVersionsAdminRepository } from "./content-versions-admin.repository.js";

/**
 * Admin Content Versions: list/detail across all content items, history per entity, server-side
 * diff (text + JSON), and revert (creates a new "revert-of" version, never mutates history).
 *
 * Audit codes: `admin.content.version.reverted`.
 */
@Controller("admin/content")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("content")
@LogAdminAction({ resourceType: "content.version" })
@ApiTags("Admin Content", "Versions")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class ContentVersionsAdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly repo: ContentVersionsAdminRepository
  ) {}

  @Get("versions")
  @ApiOperation({ summary: "List versions across all content items (filters: q, entityType, entityId, authorUserId, status, from, to). Pagination 25/page." })
  async list(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.write",
      "admin.content.read",
      "viewer.audit"
    ]);
    const parsed = adminContentVersionListQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.list(parsed.data);
  }

  @Get("versions/diff")
  @ApiOperation({ summary: "Server-computed diff between two version snapshots (text-line + JSON object diff)." })
  async diff(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.write",
      "admin.content.read",
      "viewer.audit"
    ]);
    const parsed = adminContentVersionDiffQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.diff(parsed.data.from, parsed.data.to);
  }

  @Get("versions/:id")
  @ApiOperation({ summary: "Full version snapshot + audit history." })
  async detail(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.write",
      "admin.content.read",
      "viewer.audit"
    ]);
    const found = await this.repo.detail(id);
    if (!found) throw new BadRequestException({ code: "content_version_not_found", id });
    return found;
  }

  @Get(":contentId/versions")
  @ApiOperation({ summary: "Version history of a specific content item, ordered newest first." })
  async historyForEntity(
    @Req() req: Request,
    @Param("contentId") contentId: string,
    @Query("entityType") entityType?: string
  ) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.write",
      "admin.content.read",
      "viewer.audit"
    ]);
    if (!entityType || entityType.trim().length === 0) {
      throw new BadRequestException({ code: "entity_type_required" });
    }
    return this.repo.historyForEntity(entityType, contentId);
  }

  @Post("versions/:id/revert")
  @ApiOperation({ summary: "Revert: create a new published version cloning this snapshot. Original history is preserved." })
  async revert(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = adminContentVersionRevertBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.revert(principal.actorId, id, parsed.data.reason);
  }
}
