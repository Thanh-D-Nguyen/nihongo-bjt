import { createPrismaClient, type Prisma, type PrismaClient } from "@nihongo-bjt/database";
import { Injectable } from "@nestjs/common";

import { DEFAULT_PLAN_SLUG } from "./monetization.constants.js";

@Injectable()
export class MonetizationRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  get client(): PrismaClient {
    return this.prisma;
  }

  async findPlanBySlug(slug: string) {
    return this.prisma.plan.findFirst({ where: { slug, status: "active" } });
  }

  /**
   * Resolves the learner's **effective** plan: active `user_subscription` if any, else the canonical `free`
   * plan row. Entitlements and `plan_quota` rows drive feature gates — avoid hard-coded `slug === "premium"`
   * checks in callers; extend plans/data instead.
   */
  async resolvePlanForUser(
    userId: string,
    tx: Prisma.TransactionClient | PrismaClient = this.prisma
  ) {
    const sub = await tx.userSubscription.findFirst({
      include: {
        plan: {
          include: {
            entitlements: { include: { entitlement: true } },
            planQuotas: { include: { quotaPolicy: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      where: {
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
        status: { in: ["active", "trialing"] },
        userId
      }
    });
    if (sub) {
      return { source: "subscription" as const, plan: sub.plan, subscription: sub };
    }
    const free = await tx.plan.findFirstOrThrow({
      include: {
        entitlements: { include: { entitlement: true } },
        planQuotas: { include: { quotaPolicy: true } }
      },
      where: { slug: DEFAULT_PLAN_SLUG, status: "active" }
    });
    return { plan: free, source: "default" as const, subscription: null };
  }

  async getFlashcardReviewDayLimit(
    userId: string,
    tx: Prisma.TransactionClient | PrismaClient
  ): Promise<number> {
    const resolved = await this.resolvePlanForUser(userId, tx);
    const policyKey = "flashcard_reviews_per_day";
    const q = resolved.plan.planQuotas.find((pq) => pq.quotaPolicy.key === policyKey);
    if (!q) {
      return 20;
    }
    return q.limitValue;
  }

  async getUsageInWindow(
    userId: string,
    quotaKey: string,
    windowKey: string,
    tx: Prisma.TransactionClient | PrismaClient
  ) {
    const row = await tx.usageCounter.findUnique({
      where: { userId_quotaKey_windowKey: { userId, quotaKey, windowKey } }
    });
    return row?.value ?? 0;
  }

  async listActiveAdPlacements() {
    return this.prisma.adPlacement.findMany({ orderBy: { code: "asc" }, where: { active: true } });
  }
}
