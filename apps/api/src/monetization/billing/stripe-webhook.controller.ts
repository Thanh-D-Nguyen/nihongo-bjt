import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  RawBodyRequest,
  Req
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Request } from "express";

import { StripeBillingProvider } from "./stripe-billing.provider.js";
import { BillingWebhookService } from "./billing-webhook.service.js";

/**
 * Public Stripe webhook endpoint — NOT behind admin auth.
 * Stripe sends POST requests here with a raw body + signature header.
 *
 * Security:
 *   - Signature verification via Stripe SDK (HMAC SHA256).
 *   - Idempotency enforced by BillingWebhookService.
 *   - No admin auth — access is verified by webhook signature only.
 *   - Raw body required for signature verification (Express must preserve it).
 */
@Controller("webhooks/stripe")
@ApiExcludeController()
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    @Inject(StripeBillingProvider) private readonly stripeProvider: StripeBillingProvider,
    @Inject(BillingWebhookService) private readonly webhookService: BillingWebhookService
  ) {}

  @Post()
  @HttpCode(200)
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature?: string
  ) {
    if (!signature) {
      throw new BadRequestException("Missing stripe-signature header");
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException(
        "Raw body not available — ensure rawBody: true is set in NestJS bootstrap"
      );
    }

    // Verify signature using Stripe SDK
    const event = this.stripeProvider.verifyWebhookSignature(rawBody, signature);
    if (!event) {
      throw new BadRequestException("Invalid webhook signature");
    }

    // Record in webhook audit trail (idempotent)
    try {
      await this.webhookService.ingestWebhook({
        eventType: event.type,
        idempotencyKey: event.id,
        provider: "stripe",
        rawPayload: event.data.object as unknown as Record<string, unknown>,
        signatureHeader: signature
      });
    } catch (err) {
      // Duplicate is fine — Stripe retries
      if ((err as { status?: number })?.status === 409) {
        this.logger.debug(`[Stripe] Duplicate webhook event: ${event.id}`);
        return { received: true };
      }
      throw err;
    }

    // Dispatch business logic
    await this.stripeProvider.handleWebhookEvent(event);

    return { received: true };
  }
}
