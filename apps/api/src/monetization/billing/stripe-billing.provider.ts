import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import Stripe from "stripe";

import type { BillingCheckoutResult, BillingProvider } from "./billing-provider.js";

/**
 * Stripe billing provider — creates real Checkout Sessions and manages subscriptions.
 *
 * Environment variables:
 *   STRIPE_SECRET_KEY     — Stripe API secret key (sk_live_* or sk_test_*)
 *   STRIPE_WEBHOOK_SECRET — Webhook endpoint signing secret (whsec_*)
 *   STRIPE_SUCCESS_URL    — Redirect URL after successful checkout
 *   STRIPE_CANCEL_URL     — Redirect URL if user cancels checkout
 *
 * Security:
 *   - Secret key must NEVER be logged or exposed.
 *   - Webhook signature verification is mandatory.
 *   - All subscription mutations go through webhook handler, not direct API calls.
 */
@Injectable()
export class StripeBillingProvider implements BillingProvider {
  private readonly logger = new Logger(StripeBillingProvider.name);
  private readonly prisma: PrismaClient = createPrismaClient();
  private stripe: Stripe | null = null;

  private getStripe(): Stripe {
    if (this.stripe) return this.stripe;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new ServiceUnavailableException({
        code: "STRIPE_NOT_CONFIGURED",
        message: "Stripe secret key is not configured"
      });
    }
    this.stripe = new Stripe(key);
    return this.stripe;
  }

  get webhookSecret(): string {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException({
        code: "STRIPE_WEBHOOK_SECRET_MISSING",
        message: "Stripe webhook signing secret is not configured"
      });
    }
    return secret;
  }

  /**
   * Create a Stripe Checkout Session for a plan upgrade.
   * The plan's `config` JSON must contain `stripePriceId`.
   */
  async startCheckout(input: {
    planSlug: string;
    userId: string;
  }): Promise<BillingCheckoutResult> {
    const stripe = this.getStripe();

    const plan = await this.prisma.plan.findFirst({
      where: { slug: input.planSlug, status: "active" }
    });
    if (!plan) {
      throw new NotFoundException("Plan not found");
    }

    const config = plan.config as Record<string, unknown>;
    const stripePriceId = config.stripePriceId as string | undefined;
    if (!stripePriceId) {
      throw new NotFoundException(
        `Plan "${input.planSlug}" does not have a Stripe price ID configured`
      );
    }

    const successUrl =
      process.env.STRIPE_SUCCESS_URL ?? "http://localhost:3000/vi/settings?subscription=success";
    const cancelUrl =
      process.env.STRIPE_CANCEL_URL ?? "http://localhost:3000/vi/settings?subscription=cancel";

    const session = await stripe.checkout.sessions.create({
      cancel_url: cancelUrl,
      client_reference_id: input.userId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      metadata: {
        nihongo_plan_id: plan.id,
        nihongo_plan_slug: plan.slug,
        nihongo_user_id: input.userId
      },
      mode: "subscription",
      success_url: successUrl
    });

    this.logger.log(
      `[Stripe] Checkout session created: ${session.id} for user=${input.userId} plan=${input.planSlug}`
    );

    return {
      checkoutUrl: session.url ?? successUrl,
      provider: "stripe",
      providerEnvironment: "production",
      providerRef: session.id
    };
  }

  /**
   * Verify Stripe webhook signature and parse the event.
   * Returns null if verification fails — caller must reject the webhook.
   */
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string): Stripe.Event | null {
    try {
      return this.getStripe().webhooks.constructEvent(
        rawBody,
        signatureHeader,
        this.webhookSecret
      );
    } catch (err) {
      this.logger.warn(
        `[Stripe] Webhook signature verification failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }

  /**
   * Handle a verified Stripe webhook event.
   * Manages subscription lifecycle: created → updated → deleted.
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    const eventType = event.type;

    switch (eventType) {
      case "checkout.session.completed": {
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "customer.subscription.updated": {
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.payment_failed": {
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      }
      default: {
        this.logger.debug(`[Stripe] Unhandled event type: ${eventType}`);
      }
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.nihongo_user_id ?? session.client_reference_id;
    const planSlug = session.metadata?.nihongo_plan_slug;
    const planId = session.metadata?.nihongo_plan_id;

    if (!userId || !planId || !planSlug) {
      this.logger.error(
        `[Stripe] checkout.session.completed missing metadata: userId=${userId} planId=${planId}`
      );
      return;
    }

    const subscriptionId = typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as Stripe.Subscription | null)?.id;

    await this.prisma.$transaction(async (tx) => {
      // Cancel existing active/trialing subscriptions
      await tx.userSubscription.updateMany({
        data: { status: "canceled" },
        where: { status: { in: ["active", "trialing"] }, userId }
      });

      const sub = await tx.userSubscription.create({
        data: {
          cancelAtPeriodEnd: false,
          currentPeriodEnd: session.expires_at
            ? new Date(session.expires_at * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          currentPeriodStart: new Date(),
          planId,
          provider: "stripe",
          providerRef: subscriptionId ?? session.id,
          status: "active",
          userId
        }
      });

      await tx.subscriptionEvent.create({
        data: {
          kind: "stripe_checkout_completed",
          payload: {
            checkoutSessionId: session.id,
            planSlug,
            stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
            stripeSubscriptionId: subscriptionId
          },
          subscriptionId: sub.id
        }
      });

      await tx.monetizationAuditLog.create({
        data: {
          action: "subscription_activated",
          actorKind: "billing",
          payload: {
            planId,
            planSlug,
            provider: "stripe",
            stripeSessionId: session.id,
            userId
          },
          userId
        }
      });
    });

    this.logger.log(
      `[Stripe] Subscription activated for userId=${userId} plan=${planSlug}`
    );
  }

  private async handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
    const providerRef = sub.id;
    const existing = await this.prisma.userSubscription.findFirst({
      where: { provider: "stripe", providerRef }
    });

    if (!existing) {
      this.logger.warn(`[Stripe] subscription.updated: no matching sub for providerRef=${providerRef}`);
      return;
    }

    const statusMap: Record<string, string> = {
      active: "active",
      canceled: "canceled",
      incomplete: "trialing",
      incomplete_expired: "expired",
      past_due: "active",
      paused: "canceled",
      trialing: "trialing",
      unpaid: "expired"
    };

    const mappedStatus = statusMap[sub.status] ?? "active";

    // In Stripe v22+, period dates are on SubscriptionItem, not Subscription.
    // Use billing_cycle_anchor + start_date as approximate period boundaries.
    const periodStart = sub.start_date ? new Date(sub.start_date * 1000) : new Date();
    const periodEnd = sub.cancel_at ? new Date(sub.cancel_at * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.userSubscription.update({
        data: {
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          currentPeriodEnd: periodEnd,
          currentPeriodStart: periodStart,
          status: mappedStatus
        },
        where: { id: existing.id }
      });

      await tx.subscriptionEvent.create({
        data: {
          kind: "stripe_subscription_updated",
          payload: {
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            previousStatus: existing.status,
            stripeStatus: sub.status,
            stripeSubscriptionId: sub.id
          },
          subscriptionId: existing.id
        }
      });
    });

    this.logger.log(
      `[Stripe] Subscription updated: ${providerRef} → ${mappedStatus}`
    );
  }

  private async handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
    const providerRef = sub.id;
    const existing = await this.prisma.userSubscription.findFirst({
      where: { provider: "stripe", providerRef }
    });

    if (!existing) {
      this.logger.warn(`[Stripe] subscription.deleted: no matching sub for providerRef=${providerRef}`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userSubscription.update({
        data: { status: "canceled" },
        where: { id: existing.id }
      });

      await tx.subscriptionEvent.create({
        data: {
          kind: "stripe_subscription_deleted",
          payload: { stripeSubscriptionId: sub.id },
          subscriptionId: existing.id
        }
      });

      await tx.monetizationAuditLog.create({
        data: {
          action: "subscription_canceled",
          actorKind: "billing",
          payload: {
            provider: "stripe",
            reason: "stripe_webhook_deleted",
            stripeSubscriptionId: sub.id,
            userId: existing.userId
          },
          userId: existing.userId
        }
      });
    });

    this.logger.log(`[Stripe] Subscription canceled: ${providerRef}`);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    // In Stripe v22+, subscription is in invoice.parent.subscription_details
    const subscriptionId = invoice.parent?.subscription_details?.subscription as string | undefined;

    if (!subscriptionId) return;

    const existing = await this.prisma.userSubscription.findFirst({
      where: { provider: "stripe", providerRef: subscriptionId }
    });

    if (!existing) return;

    await this.prisma.subscriptionEvent.create({
      data: {
        kind: "stripe_payment_failed",
        payload: {
          attemptCount: invoice.attempt_count,
          invoiceId: invoice.id,
          stripeSubscriptionId: subscriptionId
        },
        subscriptionId: existing.id
      }
    });

    this.logger.warn(
      `[Stripe] Payment failed for subscription=${subscriptionId} attempt=${invoice.attempt_count}`
    );
  }
}
