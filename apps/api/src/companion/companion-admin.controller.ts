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
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags
} from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { CompanionTipService } from "./companion-tip.service.js";

const COMPANION_RIVE_ASSETS = [
  { file: "18912-35694-lil-guy.riv", label: "Lil Guy (default companion)" },
  { file: "20538-38646-cheeky-chops.riv", label: "Cheeky Chops" },
  { file: "23764-44433-character-customization-ui.riv", label: "Character Customization" },
  { file: "24876-46460-interactive-bunny-character.riv", label: "Bunny Character" },
  { file: "cat-with-butterfly.riv", label: "Cat with Butterfly" },
];

const VALID_CATEGORIES = ["grammar", "vocab", "keigo", "culture", "business"];

const createTipSchema = z.object({
  category: z.string().refine((v) => VALID_CATEGORIES.includes(v), { message: "Invalid category" }),
  contentJa: z.string().trim().min(1).max(2000),
  contentVi: z.string().trim().min(1).max(2000),
  exampleJa: z.string().trim().max(1000).optional(),
  exampleVi: z.string().trim().max(1000).optional(),
  jlptLevel: z.string().trim().max(8).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

const updateTipSchema = z.object({
  category: z.string().refine((v) => VALID_CATEGORIES.includes(v)).optional(),
  contentJa: z.string().trim().min(1).max(2000).optional(),
  contentVi: z.string().trim().min(1).max(2000).optional(),
  exampleJa: z.string().trim().max(1000).nullable().optional(),
  exampleVi: z.string().trim().max(1000).nullable().optional(),
  jlptLevel: z.string().trim().max(8).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

@Controller("admin/companion")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("content")
@LogAdminAction({ resourceType: "content.companion" })
@ApiTags("Admin Companion")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class CompanionAdminController {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(CompanionTipService) private readonly tipService: CompanionTipService
  ) {}

  @Get("config")
  @ApiOperation({ summary: "Get companion bot configuration." })
  @ApiOkResponse({ description: "Companion configuration overview." })
  async getConfig(@Req() req: Request) {
    await this.auth.requireOneOfPermissions(req, ["admin.content.read", "admin.content.write"]);
    const tips = await this.tipService.listAll();
    return {
      currentRiveAsset: "18912-35694-lil-guy.riv",
      availableRiveAssets: COMPANION_RIVE_ASSETS,
      proactiveTipIntervalMs: 45_000,
      sleepTimeoutMs: 120_000,
      tipCount: tips.length,
      tipCategories: this.tipService.getCategories(),
    };
  }

  @Get("tips")
  @ApiOperation({ summary: "List all companion tips." })
  @ApiOkResponse({ description: "All companion tips from database." })
  async listTips(@Req() req: Request) {
    await this.auth.requireOneOfPermissions(req, ["admin.content.read", "admin.content.write"]);
    return this.tipService.listAll();
  }

  @Post("tips")
  @ApiOperation({ summary: "Create a new companion tip." })
  @ApiBody({ description: "Tip content" })
  @ApiOkResponse({ description: "Created tip." })
  async createTip(@Req() req: Request, @Body() body: unknown) {
    await this.auth.requirePermission(req, "admin.content.write");
    const parsed = createTipSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.tipService.create(parsed.data);
  }

  @Patch("tips/:id")
  @ApiOperation({ summary: "Update a companion tip." })
  @ApiParam({ name: "id", description: "Tip UUID" })
  @ApiBody({ description: "Fields to update" })
  @ApiOkResponse({ description: "Updated tip." })
  async updateTip(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    await this.auth.requirePermission(req, "admin.content.write");
    const parsed = updateTipSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    try {
      return await this.tipService.update(id, parsed.data);
    } catch {
      throw new NotFoundException("tip_not_found");
    }
  }

  @Delete("tips/:id")
  @ApiOperation({ summary: "Delete a companion tip." })
  @ApiParam({ name: "id", description: "Tip UUID" })
  @ApiOkResponse({ description: "Deleted." })
  async deleteTip(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requirePermission(req, "admin.content.write");
    try {
      return await this.tipService.remove(id);
    } catch {
      throw new NotFoundException("tip_not_found");
    }
  }
}
