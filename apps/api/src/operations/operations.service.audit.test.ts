import { describe, expect, it, vi } from "vitest";

import { OperationsService } from "./operations.service.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

describe("OperationsService admin audit coverage", () => {
  it("writes admin audit for feature flag updates", async () => {
    const service = new OperationsService();

    const existing = {
      enabled: false,
      key: "social_growth",
      killSwitch: false,
      rules: null
    };
    const updated = {
      enabled: true,
      key: "social_growth",
      killSwitch: false,
      rules: null
    };

    const featureFlagAuditCreate = vi.fn().mockResolvedValue(undefined);
    const adminAuditCreate = vi.fn().mockResolvedValue(undefined);

    (service as any).prisma = {
      $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) =>
        fn({
          adminAuditLog: { create: adminAuditCreate },
          featureFlag: { update: vi.fn().mockResolvedValue(updated) },
          featureFlagAudit: { create: featureFlagAuditCreate }
        })
      ),
      featureFlag: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(existing)
      }
    };

    const result = await service.updateFeatureFlag({
      actorId: "admin-1",
      enabled: true,
      key: "social_growth",
      reason: "rollout"
    });

    expect(result).toEqual(updated);
    expect(featureFlagAuditCreate).toHaveBeenCalledTimes(1);
    expect(featureFlagAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "feature_flag.update",
          actorId: "admin-1",
          after: updated,
          before: existing,
          flagKey: "social_growth",
          reason: "rollout"
        })
      })
    );
    expect(adminAuditCreate).toHaveBeenCalledTimes(1);
    expect(adminAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ops.feature_flag.update",
          after: updated,
          actorId: "admin-1",
          before: existing,
          reason: "rollout",
          targetId: "social_growth",
          targetType: "ops.feature_flag"
        })
      })
    );
  });

  it("writes admin audit for dead-letter resolved and discarded actions", async () => {
    const service = new OperationsService();

    const before = {
      id: "dlq-1",
      status: "open"
    };
    const after = {
      id: "dlq-1",
      resolvedAt: new Date("2026-04-29T10:00:00.000Z"),
      status: "resolved"
    };

    const adminAuditCreate = vi.fn().mockResolvedValue(undefined);

    (service as any).prisma = {
      $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) =>
        fn({
          adminAuditLog: { create: adminAuditCreate },
          deadLetterEntry: { update: vi.fn().mockResolvedValue(after) }
        })
      ),
      deadLetterEntry: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(before)
      }
    };

    const result = await service.resolveDeadLetter({
      actorId: "admin-2",
      id: "dlq-1",
      reason: "resolved after replay",
      status: "resolved"
    });

    expect(result).toEqual(after);
    expect(adminAuditCreate).toHaveBeenCalledTimes(1);
    expect(adminAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ops.dead_letter.resolved",
          after,
          actorId: "admin-2",
          before,
          reason: "resolved after replay",
          targetId: "dlq-1",
          targetType: "ops.dead_letter_entry"
        })
      })
    );

    const discardedAfter = {
      ...after,
      status: "discarded"
    };
    (service as any).prisma = {
      $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) =>
        fn({
          adminAuditLog: { create: adminAuditCreate },
          deadLetterEntry: { update: vi.fn().mockResolvedValue(discardedAfter) }
        })
      ),
      deadLetterEntry: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(before)
      }
    };

    await service.resolveDeadLetter({
      actorId: "admin-2",
      id: "dlq-1",
      reason: "discarded after triage",
      status: "discarded"
    });

    expect(adminAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ops.dead_letter.discarded",
          reason: "discarded after triage",
          targetId: "dlq-1"
        })
      })
    );
  });

  it("does not write admin audit when dead-letter entry is not open", async () => {
    const service = new OperationsService();
    const adminAuditCreate = vi.fn().mockResolvedValue(undefined);

    (service as any).prisma = {
      deadLetterEntry: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "dlq-2", status: "resolved" })
      },
      $transaction: vi.fn(),
      adminAuditLog: { create: adminAuditCreate }
    };

    await expect(
      service.resolveDeadLetter({
        actorId: "admin-3",
        id: "dlq-2",
        reason: "invalid transition",
        status: "resolved"
      })
    ).rejects.toThrow("Dead-letter entry is not open");

    expect((service as any).prisma.$transaction).not.toHaveBeenCalled();
    expect(adminAuditCreate).not.toHaveBeenCalled();
  });
});
