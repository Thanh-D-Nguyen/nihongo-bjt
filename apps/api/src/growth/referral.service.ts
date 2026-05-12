import { createPrismaClient, type Prisma, type PrismaClient } from "@nihongo-bjt/database";
import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";

import { Quota } from "../monetization/monetization.constants.js";

@Injectable()
export class ReferralService {
  private readonly prisma: PrismaClient = createPrismaClient();

  async ensureReferralCode(userId: string) {
    const existing = await this.prisma.referralCode.findUnique({ where: { userId } });
    if (existing) {
      return existing;
    }
    for (let i = 0; i < 6; i++) {
      const code = randomBytes(5).toString("hex").slice(0, 10);
      try {
        return await this.prisma.referralCode.create({
          data: { code, userId }
        });
      } catch (error: unknown) {
        const isUniqueViolation =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code: string }).code === "P2002";
        if (!isUniqueViolation) {
          throw error;
        }
      }
    }
    throw new Error("Could not allocate referral code after 6 attempts");
  }

  async getOrCreateCode(userId: string) {
    return this.ensureReferralCode(userId);
  }

  /**
   * Called when a new profile is created via referral attribution (first signup only).
   */
  async onReferredSignup(input: { referredUserId: string; refCode: string }) {
    const ref = await this.prisma.referralCode.findFirst({
      where: { code: input.refCode.toLowerCase() }
    });
    if (!ref || ref.userId === input.referredUserId) {
      return;
    }
    await this.prisma.referralEvent.create({
      data: {
        code: ref.code,
        kind: "signup",
        payload: { referredUserId: input.referredUserId },
        referredUserId: input.referredUserId,
        referrerUserId: ref.userId
      }
    });
    await this.prisma.analyticsEvent.create({
      data: {
        eventName: "referral_signup",
        payload: {
          channel: "referral",
          rewardReason: "referral_signup_bonus"
        } as Prisma.InputJsonValue,
        source: "api",
        userId: input.referredUserId
      }
    });
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);
    await this.prisma.referralQuotaCredit.create({
      data: {
        amount: 20,
        quotaKey: Quota.flashcard_reviews_per_day,
        reason: "referral_signup_bonus",
        userId: ref.userId,
        validUntil
      }
    });
    await this.prisma.monetizationAuditLog.create({
      data: {
        action: "referral_reward_granted",
        actorKind: "system",
        payload: {
          amount: 20,
          quotaKey: Quota.flashcard_reviews_per_day,
          reason: "referrer_bonus",
          referredUserId: input.referredUserId
        },
        userId: ref.userId
      }
    });
  }

  async recordLinkClick(code: string) {
    const ref = await this.prisma.referralCode.findFirst({ where: { code: code.toLowerCase() } });
    if (!ref) {
      return;
    }
    await this.prisma.referralEvent.create({
      data: {
        code: ref.code,
        kind: "link_view",
        payload: {},
        referrerUserId: ref.userId
      }
    });
    await this.prisma.analyticsEvent.create({
      data: {
        eventName: "referral_link_view",
        payload: { channel: "referral" } as Prisma.InputJsonValue,
        source: "api"
      }
    });
  }
}
