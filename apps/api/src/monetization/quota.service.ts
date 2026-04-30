import { createPrismaClient, type Prisma, type PrismaClient } from "@nihongo-bjt/database";
import { HttpException, Injectable } from "@nestjs/common";

import { Quota } from "./monetization.constants.js";
import { MonetizationRepository } from "./monetization.repository.js";
import { utcDateKey } from "./quota-window.util.js";

/**
 * **Central quota enforcement** for monetization: reads effective limits from plan + optional referral
 * credits, then updates `usage_counter` / `usage_event` in the same transaction as the domain action
 * (e.g. flashcard review). Do **not** duplicate `isPremium` checks in feature code — resolve plan/quotas here.
 */
@Injectable()
export class QuotaService {
  private readonly prisma: PrismaClient = createPrismaClient();

  constructor(private readonly repository: MonetizationRepository) {}

  /**
   * Count one flashcard review against the per-day plan quota, inside a DB transaction.
   * @throws HttpException 403 with body `{ code, quotaKey, used, limit }` when the quota is exhausted.
   */
  private async effectiveFlashcardDayLimit(
    userId: string,
    tx: Prisma.TransactionClient | PrismaClient
  ) {
    const base = await this.repository.getFlashcardReviewDayLimit(userId, tx);
    const bonus = await tx.referralQuotaCredit.aggregate({
      _sum: { amount: true },
      where: {
        quotaKey: Quota.flashcard_reviews_per_day,
        userId,
        validUntil: { gte: new Date() }
      }
    });
    return base + (bonus._sum.amount ?? 0);
  }

  async consumeFlashcardReviewInTransaction(
    tx: Prisma.TransactionClient,
    userId: string
  ): Promise<void> {
    const limit = await this.effectiveFlashcardDayLimit(userId, tx);
    await this.consumeQuotaInTransaction(tx, userId, Quota.flashcard_reviews_per_day, limit, "flashcard_review");
  }

  async consumeQuizStart(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.consumeQuizStartInTransaction(tx, userId);
    });
  }

  async consumeQuizStartInTransaction(
    tx: Prisma.TransactionClient,
    userId: string
  ): Promise<void> {
    const limit = await this.effectiveDailyLimitForQuotaKey(
      userId,
      Quota.quiz_bjt_start,
      3,
      tx
    );
    await this.consumeQuotaInTransaction(tx, userId, Quota.quiz_bjt_start, limit, "quiz_start");
  }

  private async effectiveDailyLimitForQuotaKey(
    userId: string,
    quotaKey: string,
    fallbackLimit: number,
    tx: Prisma.TransactionClient | PrismaClient
  ): Promise<number> {
    const resolved = await this.repository.resolvePlanForUser(userId, tx);
    const q = resolved.plan.planQuotas.find((pq) => pq.quotaPolicy.key === quotaKey);
    return q?.limitValue ?? fallbackLimit;
  }

  private async consumeQuotaInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    quotaKey: string,
    limit: number,
    reason: string
  ): Promise<void> {
    const windowKey = utcDateKey();
    if (limit <= 0) {
      await this.logQuotaExceededEvent(tx, { limit, quotaKey, userId, windowKey });
      throw new HttpException({ code: "QUOTA_EXCEEDED", limit, quotaKey, used: 0 }, 403);
    }

    const updated = await tx.usageCounter.updateMany({
      data: { value: { increment: 1 } },
      where: {
        quotaKey,
        userId,
        value: { lt: limit },
        windowKey
      }
    });

    if (updated.count === 0) {
      let created = false;
      try {
        await tx.usageCounter.create({
          data: { quotaKey, userId, value: 1, windowKey }
        });
        created = true;
      } catch {
        const retry = await tx.usageCounter.updateMany({
          data: { value: { increment: 1 } },
          where: {
            quotaKey,
            userId,
            value: { lt: limit },
            windowKey
          }
        });
        if (retry.count === 0) {
          const current = await tx.usageCounter.findUnique({
            where: { userId_quotaKey_windowKey: { userId, quotaKey, windowKey } }
          });
          await this.logQuotaExceededEvent(tx, { limit, quotaKey, userId, windowKey });
          throw new HttpException(
            { code: "QUOTA_EXCEEDED", limit, quotaKey, used: current?.value ?? 0 },
            403
          );
        }
      }

      if (!created) {
        const current = await tx.usageCounter.findUnique({
          where: { userId_quotaKey_windowKey: { userId, quotaKey, windowKey } }
        });
        await tx.usageEvent.create({
          data: {
            delta: 1,
            metadata: { reason },
            quotaKey,
            usageCounterId: current?.id,
            userId,
            windowKey
          }
        });
        return;
      }
    }

    const current = await tx.usageCounter.findUnique({
      where: { userId_quotaKey_windowKey: { userId, quotaKey, windowKey } }
    });
    if (!current || current.value > limit) {
      await this.logQuotaExceededEvent(tx, { limit, quotaKey, userId, windowKey });
      throw new HttpException({ code: "QUOTA_EXCEEDED", limit, quotaKey, used: current?.value ?? 0 }, 403);
    }

    await tx.usageEvent.create({
      data: {
        delta: 1,
        metadata: { reason },
        quotaKey,
        usageCounterId: current.id,
        userId,
        windowKey
      }
    });
  }

  private async logQuotaExceededEvent(
    tx: Prisma.TransactionClient,
    input: { limit: number; quotaKey: string; userId: string; windowKey: string }
  ): Promise<void> {
    const current = await tx.usageCounter.findUnique({
      where: {
        userId_quotaKey_windowKey: {
          quotaKey: input.quotaKey,
          userId: input.userId,
          windowKey: input.windowKey
        }
      }
    });
    await tx.analyticsEvent.create({
      data: {
        eventName: "monetization_quota_exceeded",
        payload: {
          limit: input.limit,
          quotaKey: input.quotaKey,
          used: current?.value ?? 0,
          userId: input.userId,
          windowKey: input.windowKey
        } as Prisma.InputJsonValue,
        source: "api",
        userId: input.userId
      }
    });
  }

  /**
   * Learner status for meters (read-only, does not increment).
   */
  async getFlashcardDaySummary(userId: string) {
    const resolved = await this.repository.resolvePlanForUser(userId, this.prisma);
    const windowKey = utcDateKey();
    const quotaKey = Quota.flashcard_reviews_per_day;
    const limit = await this.effectiveFlashcardDayLimit(userId, this.prisma);
    const used = await this.repository.getUsageInWindow(userId, quotaKey, windowKey, this.prisma);
    return {
      limit,
      planSlug: resolved.plan.slug,
      remaining: Math.max(0, limit - used),
      subscriptionSource: resolved.source,
      used,
      windowKey
    };
  }
}
