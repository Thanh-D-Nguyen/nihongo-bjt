import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags
} from "@nestjs/swagger";
import type { Request } from "express";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { AnnouncementRepository } from "./announcement.repository.js";

@Controller("admin/announcements")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("content")
@LogAdminAction({ resourceType: "content.announcement" })
@ApiTags("Admin Announcements")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class AnnouncementAdminController {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(AnnouncementRepository) private readonly repo: AnnouncementRepository
  ) {}

  @Get()
  @ApiOperation({ summary: "List all announcements" })
  @ApiOkResponse({ description: "All announcements (active & inactive)" })
  async list(@Req() req: Request) {
    await this.auth.requireOneOfPermissions(req, ["admin.content.read", "admin.content.write"]);
    return this.repo.listAll();
  }

  @Post()
  @ApiOperation({ summary: "Create announcement" })
  @ApiOkResponse({ description: "Created announcement" })
  async create(
    @Req() req: Request,
    @Body() body: { type?: string; message: string; href?: string | null; active?: boolean; sortOrder?: number }
  ) {
    await this.auth.requirePermission(req, "admin.content.write");
    if (!body.message?.trim()) {
      throw new (await import("@nestjs/common")).BadRequestException("message is required");
    }
    const type = body.type ?? "info";
    if (!["info", "event", "promo"].includes(type)) {
      throw new (await import("@nestjs/common")).BadRequestException("type must be info, event, or promo");
    }
    return this.repo.create({
      type,
      message: body.message.trim(),
      href: body.href?.trim() || null,
      active: body.active ?? true,
      sortOrder: body.sortOrder ?? 0,
    });
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update announcement" })
  @ApiParam({ name: "id", description: "Announcement UUID" })
  @ApiOkResponse({ description: "Updated announcement" })
  async update(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { type?: string; message?: string; href?: string | null; active?: boolean; sortOrder?: number }
  ) {
    await this.auth.requirePermission(req, "admin.content.write");
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new (await import("@nestjs/common")).NotFoundException("Announcement not found");
    }
    const data: Record<string, unknown> = {};
    if (body.type !== undefined) {
      if (!["info", "event", "promo"].includes(body.type)) {
        throw new (await import("@nestjs/common")).BadRequestException("type must be info, event, or promo");
      }
      data.type = body.type;
    }
    if (body.message !== undefined) data.message = body.message.trim();
    if (body.href !== undefined) data.href = body.href?.trim() || null;
    if (body.active !== undefined) data.active = body.active;
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
    return this.repo.update(id, data);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete announcement" })
  @ApiParam({ name: "id", description: "Announcement UUID" })
  @ApiOkResponse({ description: "Deleted" })
  async remove(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requirePermission(req, "admin.content.write");
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new (await import("@nestjs/common")).NotFoundException("Announcement not found");
    }
    await this.repo.remove(id);
    return { deleted: true };
  }
}
