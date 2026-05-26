import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";

import { ContentQaService } from "./content-qa.service.js";

/**
 * Admin Content QA — manage the human review queue for LLM-generated and
 * imported content. Polymorphic across entity types.
 *
 * Audit codes: `admin.content.qa.transitioned`, `admin.content.qa.initialized`.
 */
@Controller("admin/content/qa")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("content")
@LogAdminAction({ resourceType: "content.qa" })
@ApiTags("Admin Content", "QA")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class ContentQaAdminController {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(ContentQaService) private readonly qa: ContentQaService,
  ) {}

  @Get("queue")
  @ApiOperation({
    summary:
      "Reviewer queue: latest review row per entity, filtered by state. Sorted oldest first.",
  })
  async queue(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.write",
      "admin.content.read",
      "viewer.audit",
    ]);
    const entityType = query.entityType?.trim();
    const state = query.state?.trim();
    if (!entityType) {
      throw new BadRequestException({ code: "entity_type_required" });
    }
    if (!state || !ContentQaService.STATES.includes(state as never)) {
      throw new BadRequestException({
        code: "invalid_state",
        allowed: ContentQaService.STATES,
      });
    }
    const limit = parseIntOr(query.limit, 50);
    const offset = parseIntOr(query.offset, 0);
    return this.qa.queue({ entityType, state, limit, offset });
  }

  @Get(":entityType/:entityId")
  @ApiOperation({
    summary: "Full review history for one entity, oldest → newest.",
  })
  async history(
    @Req() req: Request,
    @Param("entityType") entityType: string,
    @Param("entityId") entityId: string,
  ) {
    await this.auth.requireOneOfPermissions(req, [
      "admin.content.write",
      "admin.content.read",
      "viewer.audit",
    ]);
    return this.qa.getHistory(entityType, entityId);
  }

  @Post(":entityType/:entityId/initialize")
  @ApiOperation({
    summary:
      "Create the initial 'pending' QA row for an entity. Fails if one already exists.",
  })
  async initialize(
    @Req() req: Request,
    @Param("entityType") entityType: string,
    @Param("entityId") entityId: string,
    @Body() body: unknown,
  ) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const comment = typeof raw.comment === "string" ? raw.comment : undefined;
    return this.qa.initialize({
      entityType,
      entityId,
      reviewerId: principal.actorId,
      comment,
    });
  }

  @Post(":entityType/:entityId/transition")
  @ApiOperation({
    summary:
      "Move the QA state forward. Body: `{ toState, comment? }`. Throws on illegal transitions.",
  })
  async transition(
    @Req() req: Request,
    @Param("entityType") entityType: string,
    @Param("entityId") entityId: string,
    @Body() body: unknown,
  ) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const toState = typeof raw.toState === "string" ? raw.toState : "";
    const comment = typeof raw.comment === "string" ? raw.comment : undefined;
    if (!toState) {
      throw new BadRequestException({ code: "to_state_required" });
    }
    return this.qa.transition({
      entityType,
      entityId,
      toState,
      reviewerId: principal.actorId,
      comment,
    });
  }
}

function parseIntOr(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}
