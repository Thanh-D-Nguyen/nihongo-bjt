import { createPrismaClient, type Prisma, type PrismaClient } from "@nihongo-bjt/database";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { adsRuntimeClickBodySchema, adsRuntimeImpressionBodySchema } from "@nihongo-bjt/shared";

import { LocalAdProvider } from "./local-ad.provider.js";
import type { AdDecideInput } from "./ad-provider.js";

@Injectable()
export class AdsRuntimeService {
  private readonly prisma: PrismaClient = createPrismaClient();

  constructor(private readonly ads: LocalAdProvider) {}

  async decide(input: AdDecideInput) {
    return this.ads.decide(input);
  }

  async recordImpression(userId: string, body: unknown) {
    const p = adsRuntimeImpressionBodySchema.safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    if (p.data.userId !== userId) {
      throw new BadRequestException("userId mismatch");
    }
    const placement = await this.prisma.adPlacement.findFirst({
      where: { active: true, code: p.data.placementCode }
    });
    if (!placement) {
      throw new NotFoundException("Ad placement not found");
    }
    if (p.data.campaignId) {
      const c = await this.prisma.adCampaign.findFirst({
        where: { id: p.data.campaignId, status: { in: ["active", "draft"] } }
      });
      if (!c) {
        throw new BadRequestException("Invalid campaign");
      }
      const codes = c.placementCodes as string[];
      if (!codes.includes(placement.code)) {
        throw new BadRequestException("Campaign does not target placement");
      }
    }
    await this.prisma.adImpression.create({
      data: {
        campaignId: p.data.campaignId ?? null,
        clientContext: (p.data.clientContext ?? null) as Prisma.InputJsonValue,
        decisionKey: p.data.decisionKey ?? null,
        kind: p.data.kind,
        placementId: placement.id,
        userId: p.data.userId
      }
    });
    return { ok: true as const };
  }

  async recordClick(userId: string, body: unknown) {
    const p = adsRuntimeClickBodySchema.safeParse(body);
    if (!p.success) {
      throw new BadRequestException(p.error.flatten());
    }
    if (p.data.userId !== userId) {
      throw new BadRequestException("userId mismatch");
    }
    const placement = await this.prisma.adPlacement.findFirst({
      where: { active: true, code: p.data.placementCode }
    });
    if (!placement) {
      throw new NotFoundException("Ad placement not found");
    }
    if (p.data.campaignId) {
      const c = await this.prisma.adCampaign.findFirst({ where: { id: p.data.campaignId } });
      if (!c) {
        throw new BadRequestException("Invalid campaign");
      }
      const codes = c.placementCodes as string[];
      if (!codes.includes(placement.code)) {
        throw new BadRequestException("Campaign does not target placement");
      }
    }
    await this.prisma.adImpression.create({
      data: {
        campaignId: p.data.campaignId ?? null,
        clientContext: (p.data.clientContext ?? null) as Prisma.InputJsonValue,
        decisionKey: p.data.decisionKey ?? null,
        kind: "click",
        placementId: placement.id,
        userId: p.data.userId
      }
    });
    return { ok: true as const };
  }
}
