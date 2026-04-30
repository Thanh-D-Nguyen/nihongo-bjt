import { describe, expect, it, vi } from "vitest";

import { OperationsService } from "./operations.service.js";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:15432/nihongo_bjt";

describe("OperationsService import staging bridge", () => {
  it("lists import staging errors with bounded filters and related batch/raw item context", async () => {
    const service = new OperationsService();
    const findMany = vi.fn().mockResolvedValue([{ id: "err-1" }]);

    (service as any).prisma = {
      contentImportError: { findMany }
    };

    await expect(
      service.listImportStagingErrors({
        batchId: "batch-1",
        limit: 25,
        phase: "validate",
        severity: "error"
      })
    ).resolves.toEqual([{ id: "err-1" }]);

    expect(findMany).toHaveBeenCalledWith({
      include: {
        batch: true,
        rawItem: true
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      where: {
        importBatchId: "batch-1",
        phase: "validate",
        severity: "error"
      }
    });
  });

  it("creates a real dead-letter entry for an import error and audits the mutation", async () => {
    const service = new OperationsService();
    const importError = {
      batch: { id: "batch-1", sourceDir: "archive/phase-00-data-import/json", sourceType: "javi" },
      code: "missing_translation",
      id: "err-1",
      importBatchId: "batch-1",
      message: "translationVi is required",
      phase: "validate",
      rawItem: { id: "raw-1", sourceFile: "lexemes.json", sourceKey: "lexeme:1" },
      rawItemId: "raw-1",
      sample: { headword: "会議" },
      severity: "error",
      sourceFile: "lexemes.json",
      sourceKey: "lexeme:1"
    };
    const createdDeadLetter = { id: "dlq-1", status: "open" };
    const adminAuditCreate = vi.fn().mockResolvedValue(undefined);
    const createDeadLetter = vi.fn().mockResolvedValue(createdDeadLetter);

    (service as any).prisma = {
      $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) =>
        fn({
          adminAuditLog: { create: adminAuditCreate },
          deadLetterEntry: { create: createDeadLetter }
        })
      ),
      contentImportError: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(importError)
      },
      deadLetterEntry: {
        findFirst: vi.fn().mockResolvedValue(null)
      }
    };

    await expect(
      service.escalateImportErrorToDeadLetter({
        actorId: "admin-1",
        id: "err-1",
        reason: "queue for retry"
      })
    ).resolves.toEqual(createdDeadLetter);

    expect((service as any).prisma.deadLetterEntry.findFirst).toHaveBeenCalledWith({
      where: {
        eventType: "content_import_error:err-1",
        source: "content_import_error",
        status: { in: ["open", "failed"] }
      }
    });
    expect(createDeadLetter).toHaveBeenCalledWith({
      data: expect.objectContaining({
        errorCode: "missing_translation",
        errorMessage: "translationVi is required",
        eventType: "content_import_error:err-1",
        payload: expect.objectContaining({
          batchId: "batch-1",
          importErrorId: "err-1",
          phase: "validate",
          rawItemId: "raw-1",
          sourceFile: "lexemes.json",
          sourceKey: "lexeme:1"
        }),
        queueName: "content.import",
        source: "content_import_error"
      })
    });
    expect(adminAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ops.import_error.dead_letter.create",
          actorId: "admin-1",
          reason: "queue for retry",
          targetId: "err-1",
          targetType: "content.import_error"
        })
      })
    );
  });

  it("returns an existing open dead-letter entry instead of creating a duplicate", async () => {
    const service = new OperationsService();
    const existingDeadLetter = { id: "dlq-1", status: "open" };

    (service as any).prisma = {
      adminAuditLog: { create: vi.fn() },
      contentImportError: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          batch: { id: "batch-1", sourceDir: "archive/phase-00-data-import/json", sourceType: "javi" },
          code: "missing_translation",
          id: "err-1",
          importBatchId: "batch-1",
          message: "translationVi is required",
          phase: "validate",
          rawItem: null,
          rawItemId: null,
          sample: null,
          severity: "error",
          sourceFile: "lexemes.json",
          sourceKey: "lexeme:1"
        })
      },
      deadLetterEntry: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(existingDeadLetter)
      }
    };

    await expect(
      service.escalateImportErrorToDeadLetter({
        actorId: "admin-1",
        id: "err-1",
        reason: "queue for retry"
      })
    ).resolves.toEqual(existingDeadLetter);

    expect((service as any).prisma.deadLetterEntry.create).not.toHaveBeenCalled();
    expect((service as any).prisma.adminAuditLog.create).not.toHaveBeenCalled();
  });
});
