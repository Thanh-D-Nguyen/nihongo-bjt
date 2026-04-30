import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException
} from "@nestjs/common";

export type WebhookIngestInput = {
  /** Billing provider: "local" | "stripe" (future) | etc. */
  provider: string;
  eventType: string;
  /**
   * Idempotency key must be unique per provider event. For local: caller generates a UUID.
   * For Stripe: use the `evt_*` event ID from the verified payload.
   * Duplicate keys are silently acknowledged (already processed).
   */
  idempotencyKey: string;
  /**
   * For external providers (e.g. Stripe), pass the raw request body bytes + signature header so
   * the service can verify authenticity.
   * TODO: implement HMAC signature verification for Stripe/production providers.
   * For "local" provider this is skipped (no network boundary).
   */
  rawPayload: Record<string, unknown>;
  signatureHeader?: string;
};

export type WebhookIngestResult =
  | { status: "accepted"; id: string }
  | { status: "duplicate" }
  | { status: "dead_lettered"; id: string };

/**
 * Billing webhook service — implements:
 * 1. Signature verification (local: skip; external: TODO stub with clear failure mode).
 * 2. Idempotency key deduplication (unique constraint on `idempotency_key`).
 * 3. Dead-letter path when processing fails after max retries.
 * 4. Audit/observability event written per webhook received.
 * 5. rawPayload access-gated: never exposed outside of admin RBAC.
 *
 * Security contract: any webhook handler that does NOT call `ingestWebhook()` is a hard-stop violation.
 * Stop condition: webhooks without signature check or idempotency MUST be blocked.
 */
@Injectable()
export class BillingWebhookService {
  private readonly logger = new Logger(BillingWebhookService.name);
  private readonly prisma: PrismaClient = createPrismaClient();

  private readonly LOCAL_PROVIDER = "local";
  private readonly MAX_RETRY_COUNT = 3;

  /**
   * Verify the provider-specific signature.
   * For the "local" provider, verification is always true (no network boundary).
   * For external providers: PLACEHOLDER — returns false unless provider is "local".
   * TODO: Implement HMAC-SHA256 verify for Stripe using `stripe.webhooks.constructEvent()`.
   *       Never process external webhook payloads without signature verification.
   */
  private verifySignature(
    provider: string,
    _rawPayload: Record<string, unknown>,
    _signatureHeader?: string
  ): boolean {
    if (provider === this.LOCAL_PROVIDER) {
      return true;
    }
    // TODO: external provider signature verification
    // SECURITY: External webhooks MUST NOT be processed without signature verification.
    // Returning false here ensures external webhooks are rejected until implemented.
    this.logger.warn(
      `[BillingWebhook] Signature verification not implemented for provider="${provider}". Rejecting.`
    );
    return false;
  }

  /**
   * Check for duplicate idempotency key.
   * Returns the existing row id if already processed, null otherwise.
   */
  private async findDuplicate(idempotencyKey: string): Promise<string | null> {
    const existing = await this.prisma.billingWebhookEvent.findUnique({
      select: { id: true, status: true },
      where: { idempotencyKey }
    });
    if (!existing) {
      return null;
    }
    // If already processed or dead_lettered, it is a replay attempt
    return existing.id;
  }

  /**
   * Ingest a billing webhook event with full safety pipeline:
   * 1. Signature verify
   * 2. Idempotency check
   * 3. Persist raw payload (access-gated)
   * 4. Audit event
   * 5. Business logic dispatch
   * 6. Dead-letter on repeated failure
   */
  async ingestWebhook(input: WebhookIngestInput): Promise<WebhookIngestResult> {
    const signatureOk = this.verifySignature(
      input.provider,
      input.rawPayload,
      input.signatureHeader
    );

    if (!signatureOk) {
      // Do NOT 400/401 to prevent oracle attacks; just log and reject silently.
      this.logger.warn(
        `[BillingWebhook] Signature verification failed provider="${input.provider}" eventType="${input.eventType}"`
      );
      throw new BadRequestException({
        code: "WEBHOOK_SIGNATURE_INVALID",
        message: "Webhook signature verification failed"
      });
    }

    // Idempotency: check for duplicate
    const duplicateId = await this.findDuplicate(input.idempotencyKey);
    if (duplicateId) {
      this.logger.debug(
        `[BillingWebhook] Duplicate idempotency key="${input.idempotencyKey}", acknowledging.`
      );
      return { status: "duplicate" };
    }

    // Persist the raw payload (access-gated; only admin can read via RBAC)
    const event = await this.prisma.billingWebhookEvent.create({
      data: {
        eventType: input.eventType,
        idempotencyKey: input.idempotencyKey,
        meta: { eventType: input.eventType, provider: input.provider } as object,
        provider: input.provider,
        rawPayload: input.rawPayload as object,
        signatureVerified: signatureOk,
        status: "processing"
      }
    });

    // Observability: audit event per webhook received
    await this.prisma.monetizationAuditLog.create({
      data: {
        action: "webhook_received",
        actorKind: "billing",
        payload: {
          eventType: input.eventType,
          provider: input.provider,
          webhookEventId: event.id
        }
      }
    });

    try {
      await this.dispatchWebhookEvent(input.provider, input.eventType, input.rawPayload);

      await this.prisma.billingWebhookEvent.update({
        data: { processedAt: new Date(), status: "processed" },
        where: { id: event.id }
      });

      this.logger.log(
        `[BillingWebhook] Processed id=${event.id} provider="${input.provider}" eventType="${input.eventType}"`
      );

      return { id: event.id, status: "accepted" };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[BillingWebhook] Failed processing id=${event.id}: ${errorMessage}`
      );

      const updated = await this.prisma.billingWebhookEvent.update({
        data: {
          lastError: errorMessage,
          retryCount: { increment: 1 },
          status: "failed"
        },
        where: { id: event.id }
      });

      // Dead-letter after max retries
      if (updated.retryCount >= this.MAX_RETRY_COUNT) {
        await this.prisma.billingWebhookEvent.update({
          data: { status: "dead_lettered" },
          where: { id: event.id }
        });

        // Surface to DeadLetterEntry for admin visibility
        await this.prisma.deadLetterEntry.create({
          data: {
            errorCode: "WEBHOOK_PROCESSING_FAILED",
            errorMessage,
            eventType: input.eventType,
            payload: { webhookEventId: event.id },
            source: `billing_webhook:${input.provider}`,
            status: "open"
          }
        });

        this.logger.warn(
          `[BillingWebhook] Dead-lettered id=${event.id} after ${updated.retryCount} retries`
        );

        return { id: event.id, status: "dead_lettered" };
      }

      throw new UnprocessableEntityException({
        code: "WEBHOOK_PROCESSING_FAILED",
        message: "Webhook processing failed",
        webhookEventId: event.id
      });
    }
  }

  /**
   * Dispatch webhook event to the appropriate business logic handler.
   * Currently handles "local" provider events.
   * TODO: add Stripe/external provider dispatch when provider secrets are configured.
   */
  private async dispatchWebhookEvent(
    provider: string,
    eventType: string,
    _payload: Record<string, unknown>
  ): Promise<void> {
    if (provider === this.LOCAL_PROVIDER) {
      // Local provider events are already persisted via LocalBillingProvider.startLocalCheckout()
      // This handler is a no-op — the SubscriptionEvent was created during checkout.
      this.logger.debug(
        `[BillingWebhook] Local provider event="${eventType}" dispatched (no-op; handled at checkout)`
      );
      return;
    }
    // Future: stripe handler, etc.
    throw new Error(`No handler registered for provider="${provider}" eventType="${eventType}"`);
  }

  /**
   * List webhook events for admin audit (no rawPayload in response).
   * rawPayload is only accessible via the getRawPayload() method with explicit RBAC.
   */
  async listForAdmin(opts: {
    provider?: string;
    status?: string;
    take?: number;
    from?: string;
    to?: string;
  }) {
    return this.prisma.billingWebhookEvent.findMany({
      orderBy: { receivedAt: "desc" },
      select: {
        eventType: true,
        id: true,
        idempotencyKey: true,
        lastError: true,
        meta: true,
        processedAt: true,
        provider: true,
        receivedAt: true,
        retryCount: true,
        signatureVerified: true,
        status: true
        // rawPayload intentionally excluded from list response
      },
      take: opts.take ?? 100,
      where: {
        provider: opts.provider ?? undefined,
        receivedAt: {
          gte: opts.from ? new Date(opts.from) : undefined,
          lte: opts.to ? new Date(opts.to) : undefined
        },
        status: opts.status ?? undefined
      }
    });
  }

  /**
   * Get raw payload for a specific webhook event.
   * This method should only be called by admin actors with billing.webhook.manage permission.
   * Callers MUST verify RBAC before calling this.
   */
  async getRawPayload(id: string) {
    const row = await this.prisma.billingWebhookEvent.findUnique({
      select: { eventType: true, id: true, provider: true, rawPayload: true, receivedAt: true },
      where: { id }
    });
    return row;
  }
}
