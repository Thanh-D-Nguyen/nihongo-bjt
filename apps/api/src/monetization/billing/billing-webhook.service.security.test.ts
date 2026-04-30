import { BadRequestException } from "@nestjs/common";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Prisma so tests don't need a real database
vi.mock("@nihongo-bjt/database", () => ({
  createPrismaClient: () => mockPrisma
}));

// --- Shared mock prisma object ---
const mockPrisma = {
  billingWebhookEvent: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  deadLetterEntry: {
    create: vi.fn()
  },
  monetizationAuditLog: {
    create: vi.fn()
  }
};

// Import after mock is set up
const { BillingWebhookService } = await import("./billing-webhook.service.js");

function buildValidLocalInput(overrides: Partial<{
  provider: string;
  eventType: string;
  idempotencyKey: string;
  rawPayload: Record<string, unknown>;
  signatureHeader?: string;
}> = {}) {
  return {
    provider: "local",
    eventType: "local_checkout_completed",
    idempotencyKey: "550e8400-e29b-41d4-a716-446655440001",
    rawPayload: { subscriptionId: "sub_123", userId: "user_456" },
    ...overrides
  };
}

describe("BillingWebhookService — security tests", () => {
  let service: InstanceType<typeof BillingWebhookService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BillingWebhookService();
    // Default: no duplicates
    mockPrisma.billingWebhookEvent.findUnique.mockResolvedValue(null);
    // Default: create returns minimal row
    mockPrisma.billingWebhookEvent.create.mockResolvedValue({
      id: "webhook-id-001",
      status: "processing",
      retryCount: 0
    });
    mockPrisma.billingWebhookEvent.update.mockResolvedValue({
      id: "webhook-id-001",
      status: "processed",
      retryCount: 0
    });
    mockPrisma.monetizationAuditLog.create.mockResolvedValue({});
  });

  it("blocks replay attack: duplicate idempotency key returns status=duplicate", async () => {
    // Arrange: existing event with the same idempotency key
    mockPrisma.billingWebhookEvent.findUnique.mockResolvedValue({
      id: "existing-webhook-id",
      status: "processed"
    });

    const input = buildValidLocalInput();
    const result = await service.ingestWebhook(input);

    expect(result.status).toBe("duplicate");
    // Must NOT create a new record when it's a duplicate
    expect(mockPrisma.billingWebhookEvent.create).not.toHaveBeenCalled();
  });

  it("rejects webhook from external provider without implementation (signature = false)", async () => {
    const input = buildValidLocalInput({
      provider: "stripe", // not local, no sig verify implemented
      signatureHeader: "t=123,v1=abc"
    });

    await expect(service.ingestWebhook(input)).rejects.toThrow(BadRequestException);
    // Must NOT create a DB record for unverified webhook
    expect(mockPrisma.billingWebhookEvent.create).not.toHaveBeenCalled();
  });

  it("accepts local provider without signature header (local = always verified)", async () => {
    const input = buildValidLocalInput({ signatureHeader: undefined });

    const result = await service.ingestWebhook(input);

    expect(result.status).toBe("accepted");
    // signatureVerified must be true for local
    expect(mockPrisma.billingWebhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ signatureVerified: true })
      })
    );
  });

  it("dead-letters after MAX_RETRY_COUNT failures and writes DeadLetterEntry", async () => {
    const dispatchError = new Error("Processing failure");

    // After dispatch fails: update sets status="failed", retryCount=3 (>= MAX_RETRY_COUNT=3)
    // Second update: status="dead_lettered" (the dead-letter write)
    mockPrisma.billingWebhookEvent.update
      .mockResolvedValueOnce({ id: "webhook-id-001", status: "failed", retryCount: 3 })
      .mockResolvedValueOnce({ id: "webhook-id-001", status: "dead_lettered", retryCount: 3 });

    const input = buildValidLocalInput({ eventType: "unknown_event" });

    (service as any).dispatchWebhookEvent = vi.fn().mockRejectedValue(dispatchError);

    const result = await service.ingestWebhook(input);

    expect(result.status).toBe("dead_lettered");
    expect(mockPrisma.deadLetterEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "billing_webhook:local",
          errorCode: "WEBHOOK_PROCESSING_FAILED"
        })
      })
    );
  });

  it("writes a MonetizationAuditLog entry for every received webhook (observability)", async () => {
    const input = buildValidLocalInput();

    await service.ingestWebhook(input);

    expect(mockPrisma.monetizationAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "webhook_received",
          actorKind: "billing"
        })
      })
    );
  });

  it("listForAdmin excludes rawPayload from select", async () => {
    const mockFind = vi.fn().mockResolvedValue([]);
    mockPrisma.billingWebhookEvent.findUnique = vi.fn();
    // Override findMany on the mock
    (mockPrisma.billingWebhookEvent as any).findMany = mockFind;

    await service.listForAdmin({});

    const call = mockFind.mock.calls[0]?.[0];
    expect(call?.select?.rawPayload).toBeUndefined();
  });
});
