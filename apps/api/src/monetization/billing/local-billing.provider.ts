import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import { Injectable, NotFoundException } from "@nestjs/common";

import type { BillingCheckoutResult, BillingProvider } from "./billing-provider.js";

@Injectable()
export class LocalBillingProvider implements BillingProvider {
  private readonly prisma: PrismaClient = createPrismaClient();

  async startLocalCheckout(input: {
    planSlug: string;
    userId: string;
  }): Promise<BillingCheckoutResult> {
    const plan = await this.prisma.plan.findFirst({
      where: { slug: input.planSlug, status: "active" }
    });
    if (!plan) {
      throw new NotFoundException("Plan not found");
    }
    const end = new Date();
    end.setFullYear(end.getFullYear() + 1);
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.userSubscription.updateMany({
        data: { status: "canceled" },
        where: { status: { in: ["active", "trialing"] }, userId: input.userId }
      });
      const sub = await tx.userSubscription.create({
        data: {
          cancelAtPeriodEnd: false,
          currentPeriodEnd: end,
          currentPeriodStart: new Date(),
          planId: plan.id,
          provider: "local",
          providerRef: `local:${input.userId}:${plan.slug}`,
          status: "active",
          userId: input.userId
        }
      });
      await tx.subscriptionEvent.create({
        data: {
          kind: "local_checkout_completed",
          payload: { planSlug: plan.slug },
          subscriptionId: sub.id
        }
      });
      await tx.monetizationAuditLog.create({
        data: {
          action: "subscription_activated",
          actorKind: "billing",
          payload: { planId: plan.id, planSlug: plan.slug, userId: input.userId },
          userId: input.userId
        }
      });
      return sub;
    });
    return {
      checkoutUrl: `/settings?subscription=local&plan=${encodeURIComponent(plan.slug)}`,
      provider: "local",
      providerEnvironment: "local_dev",
      providerRef: created.id
    };
  }
}
