import { z } from "zod";
import { BadRequestException, Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { PublicRoute } from "../keycloak/keycloak-public.decorator.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { DailyRadarRepository } from "./daily-radar.repository.js";

const listQuerySchema = z.object({
  category: z.string().trim().min(1).max(40).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  moduleKey: z.string().trim().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  status: z.enum(["draft", "published", "archived"]).optional()
});

const moduleSchema = z.object({
  category: z.string().trim().min(1).max(32),
  defaultPriority: z.coerce.number().int().optional(),
  descriptionJa: z.string().trim().optional().nullable(),
  descriptionVi: z.string().trim().min(1),
  disclaimerJa: z.string().trim().optional().nullable(),
  disclaimerVi: z.string().trim().optional().nullable(),
  externalUrl: z.string().trim().url().optional().nullable().or(z.literal("")),
  iconKey: z.string().trim().max(64).optional().nullable(),
  isEnabled: z.boolean().optional(),
  isSpotlightEligible: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  moduleKey: z.string().trim().min(2).max(80),
  moduleType: z.string().trim().min(2).max(32),
  routePath: z.string().trim().optional().nullable(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  titleEn: z.string().trim().optional().nullable(),
  titleJa: z.string().trim().min(1),
  titleVi: z.string().trim().min(1),
  visualTheme: z.string().trim().max(64).optional().nullable()
});

const cardSchema = z.object({
  badgeTextVi: z.string().trim().max(64).optional().nullable(),
  category: z.string().trim().min(1).max(32),
  ctaLabelJa: z.string().trim().optional().nullable(),
  ctaLabelVi: z.string().trim().min(1),
  descriptionVi: z.string().trim().min(1),
  endsAt: z.coerce.date().optional().nullable(),
  estimatedMinutes: z.coerce.number().int().min(1).max(240).optional().nullable(),
  iconKey: z.string().trim().max(64).optional().nullable(),
  imageUrl: z.string().trim().url().optional().nullable().or(z.literal("")),
  isPinned: z.boolean().optional(),
  isSpotlight: z.boolean().optional(),
  levelLabel: z.string().trim().max(64).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  moduleConfigId: z.uuid(),
  moduleType: z.string().trim().min(2).max(32),
  priority: z.coerce.number().int().optional(),
  recommendationReasonVi: z.string().trim().optional().nullable(),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  startsAt: z.coerce.date().optional().nullable(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  subtitleVi: z.string().trim().optional().nullable(),
  targetEntityId: z.string().trim().optional().nullable(),
  targetEntityType: z.string().trim().max(80).optional().nullable(),
  targetRoute: z.string().trim().optional().nullable(),
  titleJa: z.string().trim().optional().nullable(),
  titleVi: z.string().trim().min(1),
  visualTheme: z.string().trim().max(64).optional().nullable()
});

const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500).optional() });

@Controller("daily-radar")
@ApiTags("Daily Radar")
@DocumentedHttpErrors()
export class DailyRadarController {
  constructor(@Inject(DailyRadarRepository) private readonly repo: DailyRadarRepository) {}

  @Get("home")
  @PublicRoute()
  @ApiOperation({ summary: "Japan Daily Radar home payload." })
  home(@Query("locale") locale?: string) {
    return this.repo.home(locale || "vi");
  }

  @Get("cards")
  @PublicRoute()
  cards(@Query() query: Record<string, string | undefined>) {
    const parsed = listQuerySchema.pick({ category: true, limit: true, moduleKey: true }).safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.publicCards(parsed.data);
  }

  @Get("modules")
  @PublicRoute()
  modules() {
    return this.repo.publicModules();
  }

  @Get("cards/:slug")
  @PublicRoute()
  @ApiOperation({ summary: "Get a single radar card by slug." })
  cardBySlug(@Param("slug") slug: string) {
    return this.repo.getCardBySlug(slug);
  }
}

@Controller("admin/daily-radar")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("daily")
@LogAdminAction({ resourceType: "daily.daily_radar" })
@ApiTags("Admin Daily Radar")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class DailyRadarAdminController {
  constructor(
    @Inject(AdminAuthService) private readonly auth: AdminAuthService,
    @Inject(DailyRadarRepository) private readonly repo: DailyRadarRepository
  ) {}

  @Get("summary")
  async summary(@Req() req: Request) {
    await this.auth.requireOneOfPermissions(req, ["admin.content.read", "admin.content.write", "viewer.audit"]);
    return this.repo.adminSummary();
  }

  @Get("modules")
  async listModules(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ["admin.content.read", "admin.content.write", "viewer.audit"]);
    const parsed = listQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.listModules(parsed.data);
  }

  @Post("modules")
  async createModule(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = moduleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.createModule(principal.actorId, parsed.data);
  }

  @Get("modules/:id")
  async getModule(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, ["admin.content.read", "admin.content.write", "viewer.audit"]);
    return this.repo.getModule(id);
  }

  @Patch("modules/:id")
  async patchModule(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = moduleSchema.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.patchModule(principal.actorId, id, parsed.data);
  }

  @Post("modules/:id/archive")
  async archiveModule(@Req() req: Request, @Param("id") id: string) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    return this.repo.archiveModule(principal.actorId, id);
  }

  @Get("cards")
  async listCards(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.auth.requireOneOfPermissions(req, ["admin.content.read", "admin.content.write", "viewer.audit"]);
    const parsed = listQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.listCards(parsed.data);
  }

  @Post("cards")
  async createCard(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = cardSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.createCard(principal.actorId, parsed.data);
  }

  @Get("cards/:id")
  async getCard(@Req() req: Request, @Param("id") id: string) {
    await this.auth.requireOneOfPermissions(req, ["admin.content.read", "admin.content.write", "viewer.audit"]);
    return this.repo.getCard(id);
  }

  @Patch("cards/:id")
  async patchCard(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = cardSchema.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.patchCard(principal.actorId, id, parsed.data);
  }

  @Post("cards/:id/publish")
  async publishCard(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = reasonSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.transitionCard(principal.actorId, id, "published");
  }

  @Post("cards/:id/archive")
  async archiveCard(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    const parsed = reasonSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.repo.transitionCard(principal.actorId, id, "archived");
  }

  @Post("cards/:id/duplicate")
  async duplicateCard(@Req() req: Request, @Param("id") id: string) {
    const principal = await this.auth.requirePermission(req, "admin.content.write");
    return this.repo.duplicateCard(principal.actorId, id);
  }
}
