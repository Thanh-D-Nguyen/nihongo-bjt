import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import { AdminAuthService } from "../admin/admin-auth.service.js";
import { LogAdminAction } from "../admin/admin-audit.decorator.js";
import { AdminRbacGuard } from "../admin/admin-rbac.guard.js";
import { RequireAdminPermissions } from "../admin/admin.rbac.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { RuntimeFeatureGateService } from "../operations/runtime-feature-gate.service.js";
import { LocalBillingProvider } from "./billing/local-billing.provider.js";
import { BILLING_PERMS } from "./monetization-billing-permissions.js";
import { MonetizationAdminConsoleService } from "./monetization-admin-console.service.js";

const reasoned = <T extends z.ZodRawShape>(base: T) =>
  z.object({ ...base, reason: z.string().trim().min(3).max(2000) }).strict();

const planConfigSchema = z.record(z.string(), z.unknown()).optional();

const patchPlanSchema = reasoned({
  config: planConfigSchema,
  nameKey: z.string().min(1).max(160).optional(),
  sortOrder: z.number().int().min(0).max(1_000_000).optional(),
  status: z.enum(["active", "archived", "draft"]).optional()
});

const createPlanSchema = reasoned({
  config: planConfigSchema,
  nameKey: z.string().min(1).max(160),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9_-]*$/u),
  status: z.enum(["active", "archived", "draft"]).default("draft")
});

@Controller("admin/monetization")
@UseGuards(AdminRbacGuard)
@RequireAdminPermissions("monetization")
@LogAdminAction({ resourceType: "admin.monetization" })
@ApiTags("Admin", "Monetization")
@ApiBearerAuth("bearer")
@ApiSecurity("admin-actor")
@DocumentedHttpErrors()
export class MonetizationAdminController {
  private readonly prisma: PrismaClient = createPrismaClient();

  constructor(
    @Inject(AdminAuthService) private readonly adminAuth: AdminAuthService,
    @Inject(LocalBillingProvider) private readonly localBilling: LocalBillingProvider,
    @Inject(MonetizationAdminConsoleService) private readonly console: MonetizationAdminConsoleService,
    @Inject(RuntimeFeatureGateService) private readonly featureGate: RuntimeFeatureGateService
  ) {}

  @Get("summary")
  @ApiOperation({ summary: "Monetization dashboard counts (legacy)", description: "RBAC: billing read" })
  async summary(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.readOverview]);
    const [planCount, activeSubs, recentAudit] = await Promise.all([
      this.prisma.plan.count(),
      this.prisma.userSubscription.count({ where: { status: { in: ["active", "trialing"] } } }),
      this.prisma.monetizationAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 })
    ]);
    return { activeSubscriptionCount: activeSubs, planCount, recentMonetizationAudit: recentAudit };
  }

  @Get("overview")
  @ApiOperation({ summary: "KPIs, charts, task flags for monetization console" })
  async overview(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.readOverview]);
    const [data, enforcement] = await Promise.all([
      this.console.overview(),
      this.featureGate.status("monetization.enforcement", { missingBehavior: "allow" })
    ]);
    return { ...data, enforcementEnabled: enforcement.enabled };
  }

  @Get("analytics")
  @ApiOperation({ summary: "Monetization-related analytics events (30d); no revenue if not connected" })
  async monetizationAnalytics(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, [
      "admin.monetization.read",
      "revenue.analytics.view"
    ]);
    return this.console.monetizationAnalytics();
  }

  @Get("audit")
  @ApiOperation({ summary: "Merged admin + monetization audit feed" })
  async audit(
    @Req() req: Request,
    @Query("action") action?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.readMonetizationAudit]);
    return this.console.auditFeed({ action, from, take: 200, to });
  }

  @Get("plans")
  @ApiOperation({ summary: "Plans with entitlements, quotas, counts" })
  async listPlans(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.readPlans]);
    return this.console.plansWithStats();
  }

  @Post("plans")
  @ApiOperation({ summary: "Create plan (draft by default). Audited." })
  async createPlan(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.managePlans]);
    const p = createPlanSchema.safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    const { config, nameKey, reason, slug, status } = p.data;
    const after = await this.console.createPlan({
      config: (config ?? {}) as Prisma.InputJsonValue,
      nameKey,
      slug: slug.toLowerCase(),
      status
    });
    await this.prisma.adminAuditLog.create({
      data: {
        action: "monetization.plan.create",
        actorId: principal.actorId,
        after: { ...after } as Prisma.InputJsonValue,
        before: Prisma.JsonNull,
        reason,
        targetId: after.id,
        targetType: "monetization.plan"
      }
    });
    return after;
  }

  @Patch("plans/:id")
  @ApiOperation({ summary: "Update plan (sort, status, nameKey, config). Requires reason. Audited." })
  @ApiParam({ name: "id" })
  async updatePlan(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.managePlans]);
    const parsed = patchPlanSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const before = await this.prisma.plan.findUnique({ where: { id } });
    if (!before) {
      throw new BadRequestException("Plan not found");
    }
    const { config, nameKey, reason, sortOrder, status } = parsed.data;
    const data: {
      config?: Prisma.InputJsonValue;
      nameKey?: string;
      sortOrder?: number;
      status?: string;
    } = {};
    if (config !== undefined) {
      data.config = config as Prisma.InputJsonValue;
    }
    if (nameKey !== undefined) {
      data.nameKey = nameKey;
    }
    if (sortOrder !== undefined) {
      data.sortOrder = sortOrder;
    }
    if (status !== undefined) {
      data.status = status;
    }
    const after = await this.console.updatePlanRow(id, data);
    await this.prisma.adminAuditLog.create({
      data: {
        action: "monetization.plan.update",
        actorId: principal.actorId,
        after: { ...after } as Prisma.InputJsonValue,
        before: { ...before } as Prisma.InputJsonValue,
        reason,
        targetId: id,
        targetType: "monetization.plan"
      }
    });
    return after;
  }

  @Get("entitlements")
  @ApiOperation({ summary: "Entitlement catalog" })
  async listEntitlements(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.readEntitlements]);
    return this.console.entitlementsCatalog();
  }

  @Post("entitlements")
  @ApiOperation({ summary: "Create entitlement definition" })
  async createEntitlement(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.manageEntitlements]);
    const p = reasoned({
      category: z
        .enum([
          "flashcard",
          "bjt",
          "reading_assist",
          "analytics",
          "media",
          "ai",
          "battle",
          "ads",
          "admin"
        ])
        .optional()
        .nullable(),
      description: z.string().max(2000).optional().nullable(),
      key: z.string().min(1).max(120)
    }).safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    const { category, description, key, reason } = p.data;
    const ent = await this.console.createEntitlement({
      category: category ?? null,
      description: description ?? null,
      key
    });
    await this.prisma.adminAuditLog.create({
      data: {
        action: "monetization.entitlement.create",
        actorId: principal.actorId,
        after: { ...ent } as Prisma.InputJsonValue,
        before: Prisma.JsonNull,
        reason,
        targetId: ent.id,
        targetType: "monetization.entitlement"
      }
    });
    return ent;
  }

  @Post("plans/:planId/entitlements")
  @ApiOperation({ summary: "Link entitlement to plan" })
  async linkEntitlement(
    @Req() req: Request,
    @Param("planId") planId: string,
    @Body() body: unknown
  ) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.manageEntitlements]);
    const p = reasoned({ entitlementId: z.string().uuid() }).safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    try {
      const row = await this.console.linkPlanEntitlement(planId, p.data.entitlementId);
      await this.prisma.adminAuditLog.create({
        data: {
          action: "monetization.plan.entitlement.link",
          actorId: principal.actorId,
          after: { entitlementId: p.data.entitlementId, planId } as Prisma.InputJsonValue,
          before: Prisma.JsonNull,
          reason: p.data.reason,
          targetId: planId,
          targetType: "monetization.plan"
        }
      });
      return row;
    } catch {
      throw new BadRequestException("Link failed (duplicate or invalid ids)");
    }
  }

  @Delete("plans/:planId/entitlements/:entitlementId")
  @ApiOperation({ summary: "Remove entitlement from plan" })
  async unlinkEntitlement(
    @Req() req: Request,
    @Param("planId") planId: string,
    @Param("entitlementId") entitlementId: string,
    @Query("reason") reason: string
  ) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.manageEntitlements]);
    if (typeof reason !== "string" || reason.trim().length < 3) {
      throw new BadRequestException("query reason (min 3 chars) is required");
    }
    const row = await this.console.unlinkPlanEntitlement(planId, entitlementId);
    await this.prisma.adminAuditLog.create({
      data: {
        action: "monetization.plan.entitlement.unlink",
        actorId: principal.actorId,
        after: Prisma.JsonNull,
        before: { entitlementId, planId } as Prisma.InputJsonValue,
        reason: reason.trim(),
        targetId: planId,
        targetType: "monetization.plan"
      }
    });
    return row;
  }

  @Get("quotas")
  @ApiOperation({ summary: "Quota policies and plan-quota links" })
  async listQuotas(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.readQuotas]);
    return this.console.quotaPolicies();
  }

  @Post("quotas/policies")
  @ApiOperation({ summary: "Create quota policy" })
  async createQuotaPolicy(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.manageQuotas]);
    const p = reasoned({
      description: z.string().max(2000).optional().nullable(),
      key: z.string().min(1).max(120),
      warnThresholdPercent: z.number().int().min(0).max(100).optional().nullable(),
      windowCode: z.string().min(1).max(32)
    }).safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    const { reason, ...cp } = p.data;
    const pol = await this.console.createQuotaPolicy({
      description: cp.description ?? null,
      key: cp.key,
      warnThresholdPercent: cp.warnThresholdPercent ?? null,
      windowCode: cp.windowCode
    });
    await this.prisma.adminAuditLog.create({
      data: {
        action: "monetization.quota_policy.create",
        actorId: principal.actorId,
        after: { ...pol } as Prisma.InputJsonValue,
        before: Prisma.JsonNull,
        reason,
        targetId: pol.id,
        targetType: "monetization.quota_policy"
      }
    });
    return pol;
  }

  @Patch("quotas/policies/:id")
  @ApiOperation({ summary: "Update quota policy" })
  async patchQuotaPolicy(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.manageQuotas]);
    const p = reasoned({
      description: z.string().max(2000).optional().nullable(),
      warnThresholdPercent: z.number().int().min(0).max(100).optional().nullable(),
      windowCode: z.string().min(1).max(32).optional()
    }).safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    const b = await this.prisma.quotaPolicy.findUnique({ where: { id } });
    if (!b) {
      throw new BadRequestException("Not found");
    }
    const { reason, ...rest } = p.data;
    const after = await this.console.updateQuotaPolicy(id, rest);
    await this.prisma.adminAuditLog.create({
      data: {
        action: "monetization.quota_policy.update",
        actorId: principal.actorId,
        after: { ...after } as Prisma.InputJsonValue,
        before: { ...b } as Prisma.InputJsonValue,
        reason,
        targetId: id,
        targetType: "monetization.quota_policy"
      }
    });
    return after;
  }

  @Post("quotas/plan-links")
  @ApiOperation({ summary: "Attach quota policy to plan with limit" })
  async linkPlanQuota(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.manageQuotas]);
    const p = reasoned({
      limitValue: z.number().int().min(0).max(1_000_000_000),
      planId: z.string().uuid(),
      quotaPolicyId: z.string().uuid()
    }).safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    try {
      const row = await this.console.linkPlanQuota(p.data.planId, p.data.quotaPolicyId, p.data.limitValue);
      await this.prisma.adminAuditLog.create({
        data: {
          action: "monetization.plan_quota.create",
          actorId: principal.actorId,
          after: { ...row } as Prisma.InputJsonValue,
          before: Prisma.JsonNull,
          reason: p.data.reason,
          targetId: row.id,
          targetType: "monetization.plan_quota"
        }
      });
      return row;
    } catch {
      throw new BadRequestException("Link failed (duplicate or invalid references)");
    }
  }

  @Get("quota-overrides")
  @ApiOperation({ summary: "List quota user overrides" })
  async listQuotaOverrides(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, [
      "admin.monetization.read",
      "billing.quota.view",
      "billing.quota.override"
    ]);
    return this.console.quotaOverrides();
  }

  @Post("quota-overrides")
  @ApiOperation({ summary: "Create or replace user quota override" })
  async createQuotaOverride(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.overrideQuotas]);
    const p = reasoned({
      expiresAt: z.string().datetime().optional().nullable(),
      limitValue: z.number().int().min(0).max(1_000_000_000),
      quotaKey: z.string().min(1).max(120),
      userId: z.string().uuid()
    }).safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    const { expiresAt, limitValue, quotaKey, reason, userId } = p.data;
    const row = await this.console.createQuotaOverride({
      createdByActorId: principal.actorId,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      limitValue,
      quotaKey,
      reason,
      userId
    });
    await this.prisma.adminAuditLog.create({
      data: {
        action: "monetization.quota_override.create",
        actorId: principal.actorId,
        after: { ...row } as Prisma.InputJsonValue,
        before: Prisma.JsonNull,
        reason,
        targetId: row.id,
        targetType: "monetization.quota_override"
      }
    });
    return row;
  }

  @Delete("quota-overrides/:id")
  @ApiOperation({ summary: "Remove quota override" })
  async deleteQuotaOverride(
    @Req() req: Request,
    @Param("id") id: string,
    @Query("reason") reason: string
  ) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.overrideQuotas]);
    if (typeof reason !== "string" || reason.trim().length < 3) {
      throw new BadRequestException("query reason (min 3 chars) is required");
    }
    const b = await this.prisma.quotaUserOverride.findUnique({ where: { id } });
    if (!b) {
      throw new BadRequestException("Not found");
    }
    await this.console.deleteQuotaOverride(id);
    await this.prisma.adminAuditLog.create({
      data: {
        action: "monetization.quota_override.delete",
        actorId: principal.actorId,
        after: Prisma.JsonNull,
        before: { ...b } as Prisma.InputJsonValue,
        reason: reason.trim(),
        targetId: id,
        targetType: "monetization.quota_override"
      }
    });
    return { ok: true };
  }

  @Get("subscriptions")
  @ApiOperation({ summary: "List subscriptions" })
  async listSubscriptions(
    @Req() req: Request,
    @Query("limit") limit = "30",
    @Query("offset") offset = "0",
    @Query("q") q?: string,
    @Query("status") status?: string
  ) {
    await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.readSubscriptions]);
    return this.console.subscriptionsList({
      limit: Math.min(100, Math.max(1, Number(limit) || 30)),
      offset: Math.max(0, Number(offset) || 0),
      q,
      status
    });
  }

  @Patch("subscriptions/:id")
  @ApiOperation({ summary: "Update subscription (status, plan, trial, cancel flag)" })
  @ApiParam({ name: "id" })
  async patchSubscription(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.manageSubscriptions]);
    const p = reasoned({
      cancelAtPeriodEnd: z.boolean().optional(),
      currentPeriodEnd: z.string().datetime().optional().nullable(),
      planId: z.string().uuid().optional(),
      status: z
        .enum(["trialing", "active", "past_due", "canceled", "expired", "comped"])
        .optional(),
      trialEnd: z.string().datetime().optional().nullable()
    }).safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    const before = await this.prisma.userSubscription.findUnique({ where: { id } });
    if (!before) {
      throw new BadRequestException("Not found");
    }
    const { currentPeriodEnd, planId, reason, status, trialEnd, cancelAtPeriodEnd } = p.data;
    const data: {
      cancelAtPeriodEnd?: boolean;
      currentPeriodEnd?: Date | null;
      planId?: string;
      status?: string;
      trialEnd?: Date | null;
    } = {};
    if (status !== undefined) {
      data.status = status;
    }
    if (planId !== undefined) {
      data.planId = planId;
    }
    if (trialEnd !== undefined) {
      data.trialEnd = trialEnd ? new Date(trialEnd) : null;
    }
    if (currentPeriodEnd !== undefined) {
      data.currentPeriodEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
    }
    if (cancelAtPeriodEnd !== undefined) {
      data.cancelAtPeriodEnd = cancelAtPeriodEnd;
    }
    const after = await this.console.updateSubscription(id, data);
    await this.prisma.adminAuditLog.create({
      data: {
        action: "monetization.subscription.update",
        actorId: principal.actorId,
        after: { ...after } as Prisma.InputJsonValue,
        before: { ...before } as Prisma.InputJsonValue,
        reason,
        targetId: id,
        targetType: "monetization.user_subscription"
      }
    });
    return after;
  }

  @Get("coupons")
  @ApiOperation({ summary: "Promotion coupons" })
  async listCoupons(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.readCoupons]);
    return this.console.coupons();
  }

  @Post("coupons")
  @ApiOperation({ summary: "Create coupon" })
  async createCoupon(@Req() req: Request, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.manageCoupons]);
    const p = reasoned({
      allowedPlanSlugs: z.array(z.string().min(1).max(64)).default([]),
      code: z.string().min(1).max(64),
      discountType: z.enum(["percent", "fixed", "free_days"]),
      discountValue: z.number().int().min(0).max(1_000_000_000),
      endsAt: z.string().datetime().optional().nullable(),
      maxRedemptions: z.number().int().min(1).optional().nullable(),
      startsAt: z.string().datetime().optional().nullable(),
      status: z.enum(["active", "draft", "archived"]).default("draft")
    }).safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    const { allowedPlanSlugs, code, discountType, discountValue, endsAt, maxRedemptions, reason, startsAt, status } =
      p.data;
    const c = await this.console.createCoupon({
      allowedPlanSlugs,
      code: code.toLowerCase().trim(),
      discountType,
      discountValue,
      endsAt: endsAt ? new Date(endsAt) : null,
      maxRedemptions: maxRedemptions ?? null,
      startsAt: startsAt ? new Date(startsAt) : null,
      status
    });
    await this.prisma.adminAuditLog.create({
      data: {
        action: "monetization.coupon.create",
        actorId: principal.actorId,
        after: { ...c } as Prisma.InputJsonValue,
        before: Prisma.JsonNull,
        reason,
        targetId: c.id,
        targetType: "monetization.coupon"
      }
    });
    return c;
  }

  @Patch("coupons/:id")
  @ApiOperation({ summary: "Update coupon" })
  async patchCoupon(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.manageCoupons]);
    const p = reasoned({
      allowedPlanSlugs: z.array(z.string().min(1).max(64)).optional(),
      discountType: z.enum(["percent", "fixed", "free_days"]).optional(),
      discountValue: z.number().int().min(0).max(1_000_000_000).optional(),
      endsAt: z.string().datetime().optional().nullable(),
      maxRedemptions: z.number().int().min(1).optional().nullable(),
      startsAt: z.string().datetime().optional().nullable(),
      status: z.enum(["active", "draft", "archived"]).optional()
    }).safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    const b = await this.prisma.promotionCoupon.findUnique({ where: { id } });
    if (!b) {
      throw new BadRequestException("Not found");
    }
    const { reason, ...rest } = p.data;
    const data: {
      allowedPlanSlugs?: Prisma.InputJsonValue;
      discountType?: string;
      discountValue?: number;
      endsAt?: Date | null;
      maxRedemptions?: number | null;
      startsAt?: Date | null;
      status?: string;
    } = {};
    if (rest.allowedPlanSlugs) {
      data.allowedPlanSlugs = rest.allowedPlanSlugs;
    }
    if (rest.discountType) {
      data.discountType = rest.discountType;
    }
    if (rest.discountValue !== undefined) {
      data.discountValue = rest.discountValue;
    }
    if (rest.endsAt !== undefined) {
      data.endsAt = rest.endsAt ? new Date(rest.endsAt) : null;
    }
    if (rest.maxRedemptions !== undefined) {
      data.maxRedemptions = rest.maxRedemptions;
    }
    if (rest.startsAt !== undefined) {
      data.startsAt = rest.startsAt ? new Date(rest.startsAt) : null;
    }
    if (rest.status) {
      data.status = rest.status;
    }
    const after = await this.console.updateCoupon(id, data);
    await this.prisma.adminAuditLog.create({
      data: {
        action: "monetization.coupon.update",
        actorId: principal.actorId,
        after: { ...after } as Prisma.InputJsonValue,
        before: { ...b } as Prisma.InputJsonValue,
        reason,
        targetId: id,
        targetType: "monetization.coupon"
      }
    });
    return after;
  }

  @Get("ads/placements")
  @ApiOperation({ summary: "Ad placements with simple CTR from impressions" })
  async listAds(@Req() req: Request) {
    await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.readAds]);
    return this.console.adPlacements();
  }

  @Patch("ads/placements/:id")
  @ApiOperation({ summary: "Update ad placement (active, config JSON)" })
  @ApiParam({ name: "id" })
  async patchAdPlacement(@Req() req: Request, @Param("id") id: string, @Body() body: unknown) {
    const principal = await this.adminAuth.requireOneOfPermissions(req, [...BILLING_PERMS.manageAds]);
    const p = reasoned({ active: z.boolean().optional(), config: planConfigSchema }).safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    const b = await this.prisma.adPlacement.findUnique({ where: { id } });
    if (!b) {
      throw new BadRequestException("Not found");
    }
    const { active, config, reason } = p.data;
    const data: { active?: boolean; config?: Prisma.InputJsonValue } = {};
    if (active !== undefined) {
      data.active = active;
    }
    if (config !== undefined) {
      data.config = config as Prisma.InputJsonValue;
    }
    const after = await this.console.updateAdPlacement(id, data);
    await this.prisma.adminAuditLog.create({
      data: {
        action: "monetization.ad_placement.update",
        actorId: principal.actorId,
        after: { ...after } as Prisma.InputJsonValue,
        before: { ...b } as Prisma.InputJsonValue,
        reason,
        targetId: id,
        targetType: "monetization.ad_placement"
      }
    });
    return after;
  }

  @Patch("dev/users/:userId/plan")
  @ApiOperation({
    summary: "Dev-only: assign plan (local provider)",
    description: "RBAC: `admin.monetization.write` (legacy path)."
  })
  @ApiParam({ name: "userId" })
  async devAssignPlan(
    @Req() req: Request,
    @Param("userId") userId: string,
    @Body() body: unknown
  ) {
    const principal = await this.adminAuth.requirePermission(req, "admin.monetization.write");
    const p = z.object({ planSlug: z.string().min(1) }).safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    const result = await this.localBilling.startLocalCheckout({
      planSlug: p.data.planSlug,
      userId
    });
    await this.prisma.adminAuditLog.create({
      data: {
        action: "monetization.dev.assign_plan",
        actorId: principal.actorId,
        after: { planSlug: p.data.planSlug, userId } as Prisma.InputJsonValue,
        before: Prisma.JsonNull,
        targetId: userId,
        targetType: "user_profile"
      }
    });
    return result;
  }
}

