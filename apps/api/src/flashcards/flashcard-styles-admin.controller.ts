import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { CurrentUser } from "../keycloak/current-user.decorator.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { AdminAuditService } from "../admin/admin-audit.service.js";
import { FlashcardStylesService } from "./flashcard-styles.service.js";

@Controller("admin/flashcards/styles")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("admin_core")
@LogAdminAction({ resourceType: "admin.flashcard_styles" })
@ApiTags("Admin – Flashcard Styles")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class FlashcardStylesAdminController {
  constructor(
    @Inject(FlashcardStylesService) private readonly stylesService: FlashcardStylesService,
    @Inject(AdminAuditService) private readonly auditService: AdminAuditService
  ) {}

  @Get()
  @ApiOperation({ summary: "List all flashcard styles (admin, with filters)." })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "tier", required: false })
  @ApiQuery({ name: "q", required: false })
  async list(@Query() query: { status?: string; tier?: string; q?: string }) {
    return this.stylesService.adminList(query);
  }

  @Get("analytics/adoption")
  @ApiOperation({ summary: "Style adoption stats (how many users use each style)." })
  async adoption() {
    return this.stylesService.adminStyleAdoption();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get flashcard style by ID." })
  @ApiParam({ name: "id", type: "string" })
  async getById(@Param("id") id: string) {
    return this.stylesService.adminGetById(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a new flashcard style." })
  @ApiBody({
    schema: {
      type: "object",
      required: ["slug", "nameKey", "config", "tier"],
      properties: {
        slug: { type: "string" },
        nameKey: { type: "string" },
        descriptionKey: { type: "string", nullable: true },
        thumbnailUrl: { type: "string", nullable: true },
        config: { type: "object" },
        tier: { type: "string", enum: ["free", "premium", "exclusive"] },
        sortOrder: { type: "number" },
        status: { type: "string", enum: ["draft", "active", "archived"] }
      }
    }
  })
  async create(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body()
    body: {
      slug: string;
      nameKey: string;
      descriptionKey?: string;
      thumbnailUrl?: string;
      config: Record<string, unknown>;
      tier: string;
      sortOrder?: number;
      status?: string;
    }
  ) {
    const created = await this.stylesService.adminCreate(body);
    await this.auditService.createAuditLog({
      adminUserId: user?.appUserId ?? "system",
      action: "flashcard_style.create",
      resourceType: "flashcard_style",
      resourceId: created.id,
      afterState: JSON.parse(JSON.stringify(created))
    });
    return created;
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update flashcard style fields." })
  @ApiParam({ name: "id", type: "string" })
  async update(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body()
    body: Partial<{
      slug: string;
      nameKey: string;
      descriptionKey: string | null;
      thumbnailUrl: string | null;
      config: Record<string, unknown>;
      tier: string;
      sortOrder: number;
      status: string;
    }>
  ) {
    const before = await this.stylesService.adminGetById(id);
    const updated = await this.stylesService.adminUpdate(id, body);
    await this.auditService.createAuditLog({
      adminUserId: user?.appUserId ?? "system",
      action: "flashcard_style.update",
      resourceType: "flashcard_style",
      resourceId: id,
      beforeState: JSON.parse(JSON.stringify(before)),
      afterState: JSON.parse(JSON.stringify(updated))
    });
    return updated;
  }

  @Post(":id/transition")
  @ApiOperation({ summary: "Transition style status (draft → active → archived)." })
  @ApiParam({ name: "id", type: "string" })
  @ApiBody({
    schema: {
      type: "object",
      required: ["status"],
      properties: {
        status: { type: "string", enum: ["draft", "active", "archived"] },
        reason: { type: "string" }
      }
    }
  })
  async transition(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() body: { status: string; reason?: string }
  ) {
    const before = await this.stylesService.adminGetById(id);
    const updated = await this.stylesService.adminTransition(id, body.status);
    await this.auditService.createAuditLog({
      adminUserId: user?.appUserId ?? "system",
      action: "flashcard_style.transition",
      resourceType: "flashcard_style",
      resourceId: id,
      beforeState: JSON.parse(JSON.stringify(before)),
      afterState: JSON.parse(JSON.stringify(updated))
    });
    return updated;
  }
}
