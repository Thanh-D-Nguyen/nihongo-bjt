import { createPrismaClient, type Prisma } from "@nihongo-bjt/database";
import { shareCreateSchema, userScopedQuerySchema } from "@nihongo-bjt/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Post,
  Query,
  Res,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { ReferralService } from "./referral.service.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { RuntimeFeatureGateService } from "../operations/runtime-feature-gate.service.js";
import { ShareService } from "./share.service.js";
import { ShareImageRenderer } from "./share-image.renderer.js";

const shareKindEnum = z.enum(["streak", "bjt_result", "daily_phrase", "battle"]);

const shareTemplatesQuery = z.object({
  kind: shareKindEnum,
});

const sharePreviewQuery = z.object({
  templateId: z.string().min(1),
  kind: shareKindEnum,
  headline: z.string().min(1).max(200),
  sub: z.string().max(200).optional(),
});

@Controller("learner")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Social Sharing", "Users")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class LearnerGrowthController {
  private readonly prisma = createPrismaClient();

  constructor(
    @Inject(ShareService) private readonly share: ShareService,
    @Inject(ReferralService) private readonly referral: ReferralService,
    @Inject(RuntimeFeatureGateService) private readonly featureGate: RuntimeFeatureGateService
  ) {}

  @Get("referral")
  @ApiOperation({
    summary: "Get or create user referral code and public link",
    description: "Query `userId` (dev) per `userScopedQuerySchema`."
  })
  @ApiQuery({ name: "userId", required: true, description: "App profile id" })
  @ApiQuery({ name: "limit", required: false, type: Number, description: "1–50, default 20" })
  async referralCode(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Query() query: Record<string, string | undefined>
  ) {
    const feature = await this.featureGate.status("social_growth");
    if (!feature.enabled) {
      return { code: null, enabled: false, link: null };
    }
    const userId = resolveLearnerUserId(user, query.userId, { required: true })!;
    const p = userScopedQuerySchema.safeParse({ ...query, userId });
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    const row = await this.referral.getOrCreateCode(p.data.userId);
    const { parseServerEnv } = await import("@nihongo-bjt/config");
    const web = parseServerEnv(process.env).WEB_PUBLIC_URL.replace(/\/$/, "");
    return {
      code: row.code,
      link: `${web}/?ref=${encodeURIComponent(row.code)}`
    };
  }

  @Post("share")
  @ApiOperation({ summary: "Create a shareable snapshot (public token)", description: "Body merged with `userId` from session; `shareCreateSchema`." })
  @ApiBody({ description: "Fields per `shareCreateSchema` (kind, userId, etc.)" })
  async createShare(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown
  ) {
    await this.featureGate.requireEnabled("social_growth", {
      message: "Social sharing is temporarily disabled"
    });
    const raw = body as Record<string, unknown>;
    const userId = resolveLearnerUserId(user, raw.userId as string | undefined, { required: true })!;
    const merged = { ...raw, userId };
    const res = await this.share.createForUser(merged);
    const p = shareCreateSchema.safeParse(merged);
    const data = p.success ? p.data : null;
    if (data) {
      await this.prisma.analyticsEvent.create({
        data: {
          eventName: "share_item_created",
          payload: { consent: "share_postcard_opt_in", kind: data.kind } as Prisma.InputJsonValue,
          source: "api",
          userId: data.userId
        }
      });
    }
    return res;
  }

  @Get("share/templates")
  @ApiOperation({ summary: "List active share templates for a kind" })
  @ApiQuery({ name: "kind", required: true, enum: ["streak", "bjt_result", "daily_phrase", "battle"] })
  async shareTemplates(@Query() query: Record<string, string | undefined>) {
    const feature = await this.featureGate.status("social_growth");
    if (!feature.enabled) {
      return [];
    }
    const parsed = shareTemplatesQuery.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const templates = await this.prisma.shareTemplate.findMany({
      where: { active: true, kind: parsed.data.kind },
      select: { id: true, slug: true, kind: true, config: true },
      orderBy: { slug: "asc" },
    });
    return templates;
  }

  @Get("share/preview")
  @ApiOperation({ summary: "Render temporary postcard preview (PNG)" })
  @ApiQuery({ name: "templateId", required: true })
  @ApiQuery({ name: "kind", required: true, enum: ["streak", "bjt_result", "daily_phrase", "battle"] })
  @ApiQuery({ name: "headline", required: true })
  @ApiQuery({ name: "sub", required: false })
  async sharePreview(
    @Query() query: Record<string, string | undefined>,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.featureGate.requireEnabled("social_growth", {
      message: "Social sharing is temporarily disabled",
    });
    const parsed = sharePreviewQuery.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const { templateId, kind, headline, sub } = parsed.data;
    const template = await this.prisma.shareTemplate.findFirst({
      where: { id: templateId, active: true },
    });
    if (!template) {
      throw new NotFoundException("Template not found or inactive");
    }
    const renderer = new ShareImageRenderer();
    const png = await renderer.renderPng({
      config: (template.config as Record<string, unknown>) ?? {},
      headline,
      kind,
      sub: sub ?? "",
    });
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "no-store");
    res.send(png);
  }

  /* ── Achievement / Streak / Pet share postcards ───────────────────────── */

  @Post("shares/achievement")
  @ApiOperation({ summary: "Create a share postcard for an earned achievement tier" })
  async createAchievementShare(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown,
  ) {
    await this.featureGate.requireEnabled("social_growth", {
      message: "Social sharing is temporarily disabled",
    });
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const raw = body as Record<string, unknown>;
    const tierId = String(raw.tierId ?? "");
    if (!tierId) throw new BadRequestException("tierId required");

    const earned = await this.prisma.userAchievement.findFirst({
      where: { userId, tierId, earnedAt: { not: null } },
      include: { tier: { include: { achievement: true } } },
    });
    if (!earned) throw new NotFoundException("Achievement tier not earned");

    let template = await this.prisma.shareTemplate.findFirst({
      where: { kind: "achievement", active: true },
    });
    if (!template) {
      template = await this.prisma.shareTemplate.create({
        data: { slug: "achievement-postcard-v1", kind: "achievement", version: 1, config: {}, active: true },
      });
    }

    const publicToken = randomBytes(16).toString("hex");
    const share = await this.prisma.shareItem.create({
      data: {
        userId,
        templateId: template.id,
        publicToken,
        kind: "achievement",
        summaryPayload: {
          achievementName: earned.tier.achievement.nameKey,
          achievementSlug: earned.tier.achievement.slug,
          tierName: earned.tier.nameKey,
          tier: earned.tier.tier,
          iconUrl: earned.tier.iconUrl ?? earned.tier.achievement.iconUrl,
          category: earned.tier.achievement.category,
          earnedAt: earned.earnedAt?.toISOString(),
        },
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      shareToken: share.publicToken,
      shareUrl: `/public/shares/${share.publicToken}`,
      expiresAt: share.expiresAt,
    };
  }

  @Post("shares/streak")
  @ApiOperation({ summary: "Create a share postcard for a streak milestone" })
  async createStreakShare(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: unknown,
  ) {
    await this.featureGate.requireEnabled("social_growth", {
      message: "Social sharing is temporarily disabled",
    });
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const raw = body as Record<string, unknown>;
    const streakDays = Number(raw.streakDays ?? 0);
    if (streakDays < 7) throw new BadRequestException("Streak must be at least 7 days");

    let template = await this.prisma.shareTemplate.findFirst({
      where: { kind: "streak", active: true },
    });
    if (!template) {
      template = await this.prisma.shareTemplate.create({
        data: { slug: "streak-postcard-v1", kind: "streak", version: 1, config: {}, active: true },
      });
    }

    const publicToken = randomBytes(16).toString("hex");
    const share = await this.prisma.shareItem.create({
      data: {
        userId,
        publicToken,
        templateId: template.id,
        kind: "streak",
        summaryPayload: { streakDays, message: `${streakDays} ngày học liên tiếp! 🔥` },
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      shareToken: share.publicToken,
      shareUrl: `/public/shares/${share.publicToken}`,
      expiresAt: share.expiresAt,
    };
  }

  @Post("shares/pet-evolution")
  @ApiOperation({ summary: "Create a share postcard for a pet evolution" })
  async createPetEvolutionShare(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
  ) {
    await this.featureGate.requireEnabled("social_growth", {
      message: "Social sharing is temporarily disabled",
    });
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;

    const pet = await this.prisma.companionPet.findUnique({ where: { userId } });
    if (!pet) throw new NotFoundException("No pet found");

    let template = await this.prisma.shareTemplate.findFirst({
      where: { kind: "pet_evolution", active: true },
    });
    if (!template) {
      template = await this.prisma.shareTemplate.create({
        data: { slug: "pet-evolution-v1", kind: "pet_evolution", version: 1, config: {}, active: true },
      });
    }

    const publicToken = randomBytes(16).toString("hex");
    const share = await this.prisma.shareItem.create({
      data: {
        userId,
        publicToken,
        templateId: template.id,
        kind: "pet_evolution",
        summaryPayload: {
          petName: pet.name,
          stage: pet.stage,
          xp: pet.xp,
          message: `${pet.name} đã tiến hóa thành ${pet.stage}! 🎉`,
        },
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      shareToken: share.publicToken,
      shareUrl: `/public/shares/${share.publicToken}`,
      expiresAt: share.expiresAt,
    };
  }
}
