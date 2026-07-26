import { createPrismaClient, type Prisma, type PrismaClient } from "@nihongo-bjt/database";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { adsRuntimeClickBodySchema, adsRuntimeImpressionBodySchema } from "@nihongo-bjt/shared";

import { LocalAdProvider } from "./local-ad.provider.js";
import type { AdDecideInput } from "./ad-provider.js";
import {
  signAdDecisionToken,
  verifyAdDecisionToken,
  type AdDecisionTokenClaims
} from "./ad-decision-token.js";

const LOCAL_AD_DECISION_SECRET = "local-development-ad-decision-secret-change-me";

@Injectable()
export class AdsRuntimeService {
  private readonly prisma: PrismaClient = createPrismaClient();

  constructor(@Inject(LocalAdProvider) private readonly ads: LocalAdProvider) {}

  async decide(input: AdDecideInput) {
    const decision = await this.ads.decide(input);
    if (!decision.eligible || !decision.campaignId) {
      return decision;
    }
    return {
      ...decision,
      decisionToken: signAdDecisionToken(
        {
          campaignId: decision.campaignId,
          decisionKey: decision.decisionKey,
          placementCode: input.placementCode,
          subject: this.subjectFor(input.userId)
        },
        this.signingSecret()
      )
    };
  }

  async recordImpression(userId: string | null, body: unknown) {
    const p = adsRuntimeImpressionBodySchema.safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    if ((p.data.userId ?? null) !== userId) {
      throw new BadRequestException("userId mismatch");
    }
    if (p.data.kind !== "impression") {
      throw new BadRequestException("Client ad events may only record impressions");
    }
    const claims = this.verifyEventToken(userId, p.data);
    const placement = await this.requireActiveDecisionTarget(claims);
    return this.createDecisionEvent({
      campaignId: claims.campaignId,
      clientContext: p.data.clientContext,
      eventKey: `decision:${claims.nonce}:impression`,
      kind: "impression",
      placementId: placement.id,
      userId
    });
  }

  async recordClick(userId: string | null, body: unknown) {
    const p = adsRuntimeClickBodySchema.safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    if ((p.data.userId ?? null) !== userId) {
      throw new BadRequestException("userId mismatch");
    }
    const claims = this.verifyEventToken(userId, p.data);
    const placement = await this.requireActiveDecisionTarget(claims);
    return this.createDecisionEvent({
      campaignId: claims.campaignId,
      clientContext: p.data.clientContext,
      eventKey: `decision:${claims.nonce}:click`,
      kind: "click",
      placementId: placement.id,
      userId
    });
  }

  private async createDecisionEvent(input: {
    campaignId: string;
    clientContext?: unknown;
    eventKey: string;
    kind: "click" | "impression";
    placementId: string;
    userId: string | null;
  }) {
    try {
      await this.prisma.adImpression.create({
        data: {
          campaignId: input.campaignId,
          clientContext: (input.clientContext ?? null) as Prisma.InputJsonValue,
          decisionKey: input.eventKey,
          kind: input.kind,
          placementId: input.placementId,
          userId: input.userId
        }
      });
      return { duplicate: false, ok: true as const };
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        return { duplicate: true, ok: true as const };
      }
      throw error;
    }
  }

  private async requireActiveDecisionTarget(claims: AdDecisionTokenClaims) {
    const placement = await this.prisma.adPlacement.findFirst({
      where: { active: true, code: claims.placementCode }
    });
    if (!placement) {
      throw new NotFoundException("Ad placement not found");
    }
    const now = new Date();
    const campaign = await this.prisma.adCampaign.findFirst({
      where: {
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gte: now } }] }
        ],
        id: claims.campaignId,
        policyStatus: "ok",
        status: "active"
      }
    });
    if (!campaign) {
      throw new BadRequestException("Ad campaign is not active and approved");
    }
    const placementCodes = campaign.placementCodes as string[];
    if (!placementCodes.includes(placement.code)) {
      throw new BadRequestException("Campaign does not target placement");
    }
    return placement;
  }

  private signingSecret(): string {
    const configured = process.env.ADS_DECISION_SIGNING_SECRET?.trim();
    if (configured && configured.length >= 32) {
      return configured;
    }
    if (process.env.NODE_ENV === "production") {
      throw new ServiceUnavailableException("Ad decision signing is not configured");
    }
    return LOCAL_AD_DECISION_SECRET;
  }

  private subjectFor(userId: string | null): string {
    return userId ?? "anonymous";
  }

  private verifyEventToken(
    userId: string | null,
    data: {
      campaignId?: string;
      decisionKey?: string;
      decisionToken: string;
      placementCode: string;
    }
  ): AdDecisionTokenClaims {
    let claims: AdDecisionTokenClaims;
    try {
      claims = verifyAdDecisionToken(data.decisionToken, this.signingSecret());
    } catch {
      throw new BadRequestException("Invalid or expired ad decision token");
    }
    if (
      claims.subject !== this.subjectFor(userId) ||
      claims.placementCode !== data.placementCode ||
      (data.campaignId !== undefined && claims.campaignId !== data.campaignId) ||
      (data.decisionKey !== undefined && claims.decisionKey !== data.decisionKey)
    ) {
      throw new BadRequestException("Ad event does not match its decision");
    }
    return claims;
  }
}
