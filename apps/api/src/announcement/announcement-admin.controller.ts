import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
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

const VALID_TYPES = ["info", "event", "promo"];
const VALID_FORMATS = ["banner", "modal"];
const VALID_TARGETS = ["all", "free_only", "premium_only"];

type AnnouncementBody = {
  type?: string;
  message: string;
  href?: string | null;
  active?: boolean;
  sortOrder?: number;
  format?: string;
  target?: string;
  priority?: number;
  titleVi?: string | null;
  titleEn?: string | null;
  titleJa?: string | null;
  bodyVi?: string | null;
  bodyEn?: string | null;
  bodyJa?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  imageUrl?: string | null;
  effect?: string;
  bgPreset?: string;
  allowCloseButton?: boolean;
  allowClickOutside?: boolean;
  dismissDelay?: number;
  showFrequency?: string;
  startsAt?: string | null;
  endsAt?: string | null;
};

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
  async create(@Req() req: Request, @Body() body: AnnouncementBody) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    if (!body.message?.trim()) {
      throw new BadRequestException("message is required");
    }
    const type = body.type ?? "info";
    if (!VALID_TYPES.includes(type)) {
      throw new BadRequestException("type must be info, event, or promo");
    }
    if (body.format && !VALID_FORMATS.includes(body.format)) {
      throw new BadRequestException("format must be banner or modal");
    }
    if (body.target && !VALID_TARGETS.includes(body.target)) {
      throw new BadRequestException("target must be all, free_only, or premium_only");
    }
    return this.repo.create({
      type,
      message: body.message.trim(),
      href: body.href?.trim() || null,
      active: body.active ?? true,
      sortOrder: body.sortOrder ?? 0,
      format: body.format ?? "banner",
      target: body.target ?? "all",
      priority: body.priority ?? 0,
      titleVi: body.titleVi?.trim() || null,
      titleEn: body.titleEn?.trim() || null,
      titleJa: body.titleJa?.trim() || null,
      bodyVi: body.bodyVi?.trim() || null,
      bodyEn: body.bodyEn?.trim() || null,
      bodyJa: body.bodyJa?.trim() || null,
      ctaLabel: body.ctaLabel?.trim() || null,
      ctaUrl: body.ctaUrl?.trim() || null,
      imageUrl: body.imageUrl?.trim() || null,
      effect: body.effect ?? "none",
      bgPreset: body.bgPreset ?? "default",
      allowCloseButton: body.allowCloseButton ?? true,
      allowClickOutside: body.allowClickOutside ?? true,
      dismissDelay: body.dismissDelay ?? 0,
      showFrequency: body.showFrequency ?? "once_ever",
      startsAt: body.startsAt || null,
      endsAt: body.endsAt || null,
      createdBy: (principal as { sub?: string })?.sub ?? null,
    });
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update announcement" })
  @ApiParam({ name: "id", description: "Announcement UUID" })
  @ApiOkResponse({ description: "Updated announcement" })
  async update(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: Partial<AnnouncementBody>
  ) {
    await this.auth.requirePermission(req, "admin.content.write");
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException("Announcement not found");
    }
    if (body.type !== undefined && !VALID_TYPES.includes(body.type)) {
      throw new BadRequestException("type must be info, event, or promo");
    }
    if (body.format !== undefined && !VALID_FORMATS.includes(body.format)) {
      throw new BadRequestException("format must be banner or modal");
    }
    if (body.target !== undefined && !VALID_TARGETS.includes(body.target)) {
      throw new BadRequestException("target must be all, free_only, or premium_only");
    }
    const data: Record<string, unknown> = {};
    if (body.type !== undefined) data.type = body.type;
    if (body.message !== undefined) data.message = body.message.trim();
    if (body.href !== undefined) data.href = body.href?.trim() || null;
    if (body.active !== undefined) data.active = body.active;
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
    if (body.format !== undefined) data.format = body.format;
    if (body.target !== undefined) data.target = body.target;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.titleVi !== undefined) data.titleVi = body.titleVi?.trim() || null;
    if (body.titleEn !== undefined) data.titleEn = body.titleEn?.trim() || null;
    if (body.titleJa !== undefined) data.titleJa = body.titleJa?.trim() || null;
    if (body.bodyVi !== undefined) data.bodyVi = body.bodyVi?.trim() || null;
    if (body.bodyEn !== undefined) data.bodyEn = body.bodyEn?.trim() || null;
    if (body.bodyJa !== undefined) data.bodyJa = body.bodyJa?.trim() || null;
    if (body.ctaLabel !== undefined) data.ctaLabel = body.ctaLabel?.trim() || null;
    if (body.ctaUrl !== undefined) data.ctaUrl = body.ctaUrl?.trim() || null;
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl?.trim() || null;
    if (body.effect !== undefined) data.effect = body.effect;
    if (body.bgPreset !== undefined) data.bgPreset = body.bgPreset;
    if (body.allowCloseButton !== undefined) data.allowCloseButton = body.allowCloseButton;
    if (body.allowClickOutside !== undefined) data.allowClickOutside = body.allowClickOutside;
    if (body.dismissDelay !== undefined) data.dismissDelay = body.dismissDelay;
    if (body.showFrequency !== undefined) data.showFrequency = body.showFrequency;
    if (body.startsAt !== undefined) data.startsAt = body.startsAt || null;
    if (body.endsAt !== undefined) data.endsAt = body.endsAt || null;
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
      throw new NotFoundException("Announcement not found");
    }
    await this.repo.remove(id);
    return { deleted: true };
  }
}
