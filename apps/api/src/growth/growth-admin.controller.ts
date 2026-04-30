import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import { Body, BadRequestException, Controller, Get, Inject, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { GrowthAnalyticsService } from "./growth-analytics.service.js";

const previewSchema = z.object({
  config: z.record(z.string(), z.any()).optional(),
  headline: z.string().min(1).max(200),
  kind: z.enum(["streak", "bjt_result", "daily_phrase"]),
  sub: z.string().min(1).max(200)
});

const referralShareAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30)
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0)
});

@Controller("admin/growth")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("growth")
@LogAdminAction({ resourceType: "admin.growth" })
@ApiTags("Admin", "Social Sharing")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class GrowthAdminController {
  private readonly prisma: PrismaClient = createPrismaClient();

  constructor(
    @Inject(AdminAuthService) private readonly adminAuth: AdminAuthService,
    @Inject(GrowthAnalyticsService) private readonly growthAnalytics: GrowthAnalyticsService
  ) {}

  @Get("share-templates")
  @ApiOperation({ summary: "List share templates (admin read)", description: "RBAC: `admin.growth.read`" })
  async templates(@Req() req: Request) {
    await this.adminAuth.requirePermission(req, "admin.growth.read");
    return this.prisma.shareTemplate.findMany({ orderBy: { slug: "asc" } });
  }

  @Get("referral-share-analytics")
  @ApiOperation({
    summary: "Referral/share analytics funnel from real events (admin read)",
    description:
      "RBAC: `admin.growth.read`. Aggregate-only output with consent integrity checks; excludes user/session identifiers."
  })
  async referralShareAnalytics(@Req() req: Request, @Query() query: Record<string, string | undefined>) {
    await this.adminAuth.requirePermission(req, "admin.growth.read");
    const parsed = referralShareAnalyticsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.growthAnalytics.referralShareFunnel(parsed.data.days);
  }

  @Post("share-template/preview")
  @ApiOperation({
    summary: "Render share image preview (PNG as base64)",
    description: "RBAC: `admin.growth.read`. **Audited** as `growth.share_template.preview`."
  })
  @ApiBody({
    description: "`headline` (1–200), `sub` (1–200), `kind` enum streak|bjt_result|daily_phrase, optional `config` object"
  })
  async preview(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requirePermission(req, "admin.growth.read");
    const p = previewSchema.safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    const { ShareImageRenderer } = await import("./share-image.renderer.js");
    const renderer = new ShareImageRenderer();
    const config = p.data.config ?? {};
    const buf = await renderer.renderPng({
      config,
      headline: p.data.headline,
      kind: p.data.kind,
      sub: p.data.sub
    });
    await this.prisma.adminAuditLog.create({
      data: {
        action: "growth.share_template.preview",
        actorId: principal.actorId,
        after: { bytes: buf.length } as Prisma.InputJsonValue,
        before: Prisma.JsonNull,
        targetId: p.data.kind,
        targetType: "growth.template_preview"
      }
    });
    return { base64Png: buf.toString("base64"), format: "image/png" };
  }

  @Get("referrals")
  @ApiOperation({ summary: "List referral codes with pagination." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiOkResponse({ description: "Paginated list of referral codes." })
  async listReferrals(@Query() query: Record<string, unknown>) {
    const parsed = listQuerySchema.parse(query);
    const [items, total] = await Promise.all([
      this.prisma.referralCode.findMany({
        orderBy: { createdAt: "desc" },
        skip: parsed.offset,
        take: parsed.limit
      }),
      this.prisma.referralCode.count()
    ]);
    return { items, total };
  }

  @Get("share-items")
  @ApiOperation({ summary: "List share items (postcards/social) with pagination." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiOkResponse({ description: "Paginated list of share items." })
  async listShareItems(@Query() query: Record<string, unknown>) {
    const parsed = listQuerySchema.parse(query);
    const [items, total] = await Promise.all([
      this.prisma.shareItem.findMany({
        include: { _count: { select: { cardAssets: true } } },
        orderBy: { createdAt: "desc" },
        skip: parsed.offset,
        take: parsed.limit
      }),
      this.prisma.shareItem.count()
    ]);
    return { items, total };
  }

  @Get("campaigns")
  @ApiOperation({ summary: "List ad campaigns with pagination." })
  @ApiQuery({ name: "limit", required: false, schema: { type: "integer", default: 50 } })
  @ApiQuery({ name: "offset", required: false, schema: { type: "integer", default: 0 } })
  @ApiOkResponse({ description: "Paginated list of ad campaigns." })
  async listCampaigns(@Query() query: Record<string, unknown>) {
    const parsed = listQuerySchema.parse(query);
    const [items, total] = await Promise.all([
      this.prisma.adCampaign.findMany({
        orderBy: { createdAt: "desc" },
        skip: parsed.offset,
        take: parsed.limit
      }),
      this.prisma.adCampaign.count()
    ]);
    return { items, total };
  }
}
