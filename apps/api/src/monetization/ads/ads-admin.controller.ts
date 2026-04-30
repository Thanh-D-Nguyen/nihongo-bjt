import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import type { Request } from "express";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { AdminAuthService } from "../../admin/admin-auth.service.js";
import { LogAdminAction } from "../../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../../openapi/common-decorators.js";
import { assertSafeExternalHttpUrl } from "../../security/external-url-policy.js";
import { ADS_PERMS, ANY_ADS_READ } from "./ads-permissions.js";
import { AdsAdminService } from "./ads-admin.service.js";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";

const reasoned = <T extends z.ZodRawShape>(base: T) =>
  z.object({ ...base, reason: z.string().trim().min(3).max(2000) }).strict();

const placementConfigSchema = z.record(z.string(), z.unknown()).optional().default({});

const createPlacementSchema = reasoned({
  active: z.boolean().default(true),
  code: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/u),
  config: placementConfigSchema,
  labelKey: z.string().max(160).optional().nullable()
});

const patchPlacementSchema = reasoned({
  active: z.boolean().optional(),
  code: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/u)
    .optional(),
  config: placementConfigSchema,
  labelKey: z.string().max(160).optional().nullable()
});

const campaignSchema = reasoned({
  creativeType: z.string().max(64).optional(),
  destinationUrl: z.string().url().max(2000).optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  maxImpressions: z.number().int().min(0).optional().nullable(),
  name: z.string().min(1).max(200),
  placementCodes: z.array(z.string().min(1).max(64)),
  policyStatus: z.enum(["pending", "ok", "warning", "rejected"]).optional(),
  priority: z.number().int().min(0).max(1_000_000).optional(),
  providerKey: z.string().min(1).max(64),
  startAt: z.string().datetime().optional().nullable(),
  status: z.enum(["draft", "active", "paused", "ended"]).optional(),
  targetLocale: z.string().max(16).optional().nullable(),
  targetPlanSlug: z.string().max(64).optional().nullable()
});

const patchCampaignSchema = campaignSchema.partial();

const patchProviderSchema = reasoned({
  config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
  lastSyncAt: z.string().datetime().optional().nullable(),
  status: z.string().max(32).optional()
});

const upsertRuleBodySchema = z
  .object({
    config: z.record(z.string(), z.unknown()).optional().default({}),
    enabled: z.boolean().optional().default(true),
    reason: z.string().trim().min(3).max(2000),
    ruleKey: z.string().min(2).max(120)
  })
  .strict();

@Controller("admin/ads")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("ads")
@LogAdminAction({ resourceType: "admin.ads" })
@ApiTags("Admin", "Ads")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class AdsAdminController {
  private readonly prisma: PrismaClient = createPrismaClient();

  constructor(
    @Inject(AdminAuthService) private readonly adminAuth: AdminAuthService,
    @Inject(AdsAdminService) private readonly ads: AdsAdminService
  ) {}

  @Get("overview")
  @ApiOperation({ summary: "Ads operations overview (KPIs, charts, tasks)" })
  @ApiQuery({ name: "days", required: false, description: "Window for trend (default 7)" })
  async overview(@Req() req: Request, @Query("days") days?: string) {
    await this.adminAuth.requireOneOfPermissions(req, [...ANY_ADS_READ]);
    const d = Math.min(90, Math.max(1, Number.parseInt(days ?? "7", 10) || 7));
    const [ov, tasks] = await Promise.all([this.ads.overview(d), this.ads.tasks()]);
    return { overview: ov, tasks, windowDays: d };
  }

  @Get("placements")
  @ApiOperation({ summary: "List ad placements" })
  async listPlacements(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, ADS_PERMS.viewPlacements);
    return this.ads.listPlacements();
  }

  @Post("placements")
  @ApiOperation({ summary: "Create ad placement" })
  async createPlacement(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, ADS_PERMS.managePlacements);
    const p = createPlacementSchema.safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    const { reason, ...rest } = p.data;
    const created = await this.ads.createPlacement({
      active: rest.active,
      code: rest.code,
      config: rest.config as Prisma.InputJsonValue,
      labelKey: rest.labelKey
    });
    await this.prisma.adminAuditLog.create({
      data: {
        action: "ads.placement.create",
        actorId: principal.actorId,
        after: { ...created } as Prisma.InputJsonValue,
        before: Prisma.JsonNull,
        reason,
        targetId: created.id,
        targetType: "ad_placement"
      }
    });
    return created;
  }

  @Patch("placements/:id")
  @ApiOperation({ summary: "Update ad placement" })
  async patchPlacement(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, ADS_PERMS.managePlacements);
    const p = patchPlacementSchema.safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    const before = await this.prisma.adPlacement.findUnique({ where: { id } });
    if (!before) {
      throw new BadRequestException("Not found");
    }
    const { reason, ...rest } = p.data;
    const data: {
      active?: boolean;
      code?: string;
      config?: Prisma.InputJsonValue;
      labelKey?: string | null;
    } = {};
    if (rest.active !== undefined) {
      data.active = rest.active;
    }
    if (rest.code !== undefined) {
      data.code = rest.code;
    }
    if (rest.config !== undefined) {
      data.config = rest.config as Prisma.InputJsonValue;
    }
    if (rest.labelKey !== undefined) {
      data.labelKey = rest.labelKey;
    }
    const after = await this.ads.updatePlacement(id, data);
    await this.prisma.adminAuditLog.create({
      data: {
        action: "ads.placement.update",
        actorId: principal.actorId,
        after: { ...after } as Prisma.InputJsonValue,
        before: { ...before } as Prisma.InputJsonValue,
        reason,
        targetId: id,
        targetType: "ad_placement"
      }
    });
    return after;
  }

  @Get("campaigns")
  @ApiOperation({ summary: "List ad campaigns" })
  async listCampaigns(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, ADS_PERMS.viewCampaigns);
    return this.ads.listCampaigns();
  }

  @Post("campaigns")
  @ApiOperation({ summary: "Create ad campaign" })
  async createCampaign(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, ADS_PERMS.manageCampaigns);
    const p = campaignSchema.safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    const { reason, ...rest } = p.data;
    if (rest.destinationUrl) {
      await assertSafeExternalHttpUrl(rest.destinationUrl, "destinationUrl");
    }
    const created = await this.ads.createCampaign({
      creativeType: rest.creativeType ?? "placeholder",
      destinationUrl: rest.destinationUrl ?? null,
      endAt: rest.endAt ? new Date(rest.endAt) : null,
      maxImpressions: rest.maxImpressions ?? null,
      name: rest.name,
      placementCodes: rest.placementCodes,
      policyStatus: rest.policyStatus ?? "pending",
      priority: rest.priority ?? 0,
      providerKey: rest.providerKey,
      startAt: rest.startAt ? new Date(rest.startAt) : null,
      status: rest.status ?? "draft",
      targetLocale: rest.targetLocale ?? null,
      targetPlanSlug: rest.targetPlanSlug ?? null
    });
    await this.prisma.adminAuditLog.create({
      data: {
        action: "ads.campaign.create",
        actorId: principal.actorId,
        after: { ...created } as Prisma.InputJsonValue,
        before: Prisma.JsonNull,
        reason,
        targetId: created.id,
        targetType: "ad_campaign"
      }
    });
    return created;
  }

  @Patch("campaigns/:id")
  @ApiOperation({ summary: "Update ad campaign" })
  async patchCampaign(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, ADS_PERMS.manageCampaigns);
    const p = patchCampaignSchema.safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    if (p.data.destinationUrl) {
      await assertSafeExternalHttpUrl(p.data.destinationUrl, "destinationUrl");
    }
    const before = await this.prisma.adCampaign.findUnique({ where: { id } });
    if (!before) {
      throw new BadRequestException("Not found");
    }
    const { reason, ...rest } = p.data;
    const data: Prisma.AdCampaignUpdateInput = {};
    if (rest.name !== undefined) {
      data.name = rest.name;
    }
    if (rest.status !== undefined) {
      data.status = rest.status;
    }
    if (rest.providerKey !== undefined) {
      data.providerKey = rest.providerKey;
    }
    if (rest.placementCodes !== undefined) {
      data.placementCodes = rest.placementCodes;
    }
    if (rest.startAt !== undefined) {
      data.startAt = rest.startAt ? new Date(rest.startAt) : null;
    }
    if (rest.endAt !== undefined) {
      data.endAt = rest.endAt ? new Date(rest.endAt) : null;
    }
    if (rest.priority !== undefined) {
      data.priority = rest.priority;
    }
    if (rest.creativeType !== undefined) {
      data.creativeType = rest.creativeType;
    }
    if (rest.destinationUrl !== undefined) {
      data.destinationUrl = rest.destinationUrl;
    }
    if (rest.targetLocale !== undefined) {
      data.targetLocale = rest.targetLocale;
    }
    if (rest.targetPlanSlug !== undefined) {
      data.targetPlanSlug = rest.targetPlanSlug;
    }
    if (rest.maxImpressions !== undefined) {
      data.maxImpressions = rest.maxImpressions;
    }
    if (rest.policyStatus !== undefined) {
      data.policyStatus = rest.policyStatus;
    }
    const after = await this.ads.updateCampaign(id, data);
    await this.prisma.adminAuditLog.create({
      data: {
        action: "ads.campaign.update",
        actorId: principal.actorId,
        after: { ...after } as Prisma.InputJsonValue,
        before: { ...before } as Prisma.InputJsonValue,
        reason,
        targetId: id,
        targetType: "ad_campaign"
      }
    });
    return after;
  }

  @Get("providers")
  @ApiOperation({ summary: "List ad provider configs" })
  async listProviders(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, ADS_PERMS.viewProviders);
    return this.ads.listProviders();
  }

  @Patch("providers/:key")
  @ApiOperation({ summary: "Update ad provider" })
  async patchProvider(@Req() req: Request, @Param("key") key: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, ADS_PERMS.manageProviders);
    const p = patchProviderSchema.safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    const before = await this.prisma.adProviderConfig.findUnique({ where: { key } });
    if (!before) {
      throw new BadRequestException("Not found");
    }
    const { reason, ...rest } = p.data;
    const after = await this.ads.upsertProvider(key, {
      config: rest.config as Prisma.InputJsonValue,
      enabled: rest.enabled,
      lastSyncAt: rest.lastSyncAt ? new Date(rest.lastSyncAt) : undefined,
      status: rest.status,
      type: before.type
    });
    await this.prisma.adminAuditLog.create({
      data: {
        action: "ads.provider.update",
        actorId: principal.actorId,
        after: { ...after } as Prisma.InputJsonValue,
        before: { ...before } as Prisma.InputJsonValue,
        reason,
        targetId: after.id,
        targetType: "ad_provider_config"
      }
    });
    return after;
  }

  @Get("rules")
  @ApiOperation({ summary: "List safety rules" })
  async listRules(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, ADS_PERMS.readRules);
    return this.ads.listRules();
  }

  @Post("rules")
  @ApiOperation({ summary: "Upsert safety rule" })
  async postRule(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, ADS_PERMS.manageRules);
    const p = upsertRuleBodySchema.safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    const { reason, ruleKey, ...rest } = p.data;
    const before = await this.prisma.adSafetyRule.findUnique({ where: { ruleKey } });
    const after = await this.ads.upsertRule(ruleKey, {
      config: rest.config as Prisma.InputJsonValue,
      enabled: rest.enabled
    });
    await this.prisma.adminAuditLog.create({
      data: {
        action: "ads.safety_rule.upsert",
        actorId: principal.actorId,
        after: { ...after } as Prisma.InputJsonValue,
        before: before ? ({ ...before } as Prisma.InputJsonValue) : Prisma.JsonNull,
        reason,
        targetId: after.id,
        targetType: "ad_safety_rule"
      }
    });
    return after;
  }

  @Get("performance")
  @ApiOperation({ summary: "Performance aggregates" })
  @ApiQuery({ name: "days", required: false })
  async performance(@Req() req: Request, @Query("days") days?: string) {
    await this.adminAuth.requireOneOfPermissions(req, ADS_PERMS.readPerformance);
    const d = Math.min(90, Math.max(1, Number.parseInt(days ?? "7", 10) || 7));
    return this.ads.performance({ windowDays: d });
  }

  @Get("audit")
  @ApiOperation({ summary: "Ads-related admin audit" })
  @ApiQuery({ name: "limit", required: false })
  async audit(@Req() req: Request, @Query("limit") limit?: string) {
    await this.adminAuth.requireOneOfPermissions(req, ADS_PERMS.readAudit);
    const take = Math.min(200, Math.max(1, Number.parseInt(limit ?? "50", 10) || 50));
    return this.ads.auditLog(take);
  }
}
