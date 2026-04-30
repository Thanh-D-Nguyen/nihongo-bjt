import { createPrismaClient, type Prisma } from "@nihongo-bjt/database";
import { shareCreateSchema, userScopedQuerySchema } from "@nihongo-bjt/shared";
import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../keycloak/current-user.decorator.js";
import { KeycloakAuthGuard } from "../keycloak/keycloak-auth.guard.js";
import { resolveLearnerUserId } from "../keycloak/learner-identity.util.js";
import type { KeycloakAuthenticatedUser } from "../keycloak/keycloak.types.js";
import { ReferralService } from "./referral.service.js";
import { DocumentedHttpErrors } from "../openapi/common-decorators.js";
import { RuntimeFeatureGateService } from "../operations/runtime-feature-gate.service.js";
import { ShareService } from "./share.service.js";

@Controller("learner")
@UseGuards(KeycloakAuthGuard)
@ApiTags("Social Sharing", "Users")
@ApiBearerAuth("bearer")
@DocumentedHttpErrors()
export class LearnerGrowthController {
  private readonly prisma = createPrismaClient();

  constructor(
    private readonly share: ShareService,
    private readonly referral: ReferralService,
    private readonly featureGate: RuntimeFeatureGateService
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
    await this.featureGate.requireEnabled("social_growth", {
      message: "Social sharing is temporarily disabled"
    });
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
}
