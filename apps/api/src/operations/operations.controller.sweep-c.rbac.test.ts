import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { OperationsController } from "./operations.controller.js";

function build(opts: { read: boolean; write: boolean }) {
  const adminAuth = {
    requireOneOfPermissions: vi.fn().mockImplementation(async () => {
      if (!opts.read) throw new ForbiddenException("forbidden");
      return { actorId: "55555555-5555-4555-8555-555555555555", permissions: new Set<string>() };
    }),
    requirePermission: vi.fn().mockImplementation(async () => {
      if (!opts.write) throw new ForbiddenException("forbidden");
      return { actorId: "55555555-5555-4555-8555-555555555555", permissions: new Set<string>() };
    })
  };
  const ops = {
    bjtDashboard: vi.fn().mockResolvedValue({ generatedAt: "x" }),
    bulkImportErrorAction: vi.fn().mockResolvedValue({ processed: 0 }),
    createImportManifest: vi.fn().mockResolvedValue({ id: "m1" }),
    discardImportError: vi.fn().mockResolvedValue({ id: "x", status: "discarded" }),
    getImportManifestDetail: vi.fn().mockResolvedValue({ id: "m1" }),
    importOverview: vi.fn().mockResolvedValue({ pending: 0 }),
    listQueueActions: vi.fn().mockResolvedValue([]),
    listReleaseEvents: vi.fn().mockResolvedValue([]),
    manifestRunHistory: vi.fn().mockResolvedValue([]),
    markReleaseKnownGood: vi.fn().mockResolvedValue({ status: "known_good" }),
    partialReindex: vi.fn().mockResolvedValue({ contentType: "lexeme" }),
    prepareRollback: vi.fn().mockResolvedValue({ status: "rollback_prepared" }),
    retryImportError: vi.fn().mockResolvedValue({ id: "x", status: "retry_requested" }),
    runImportManifest: vi.fn().mockResolvedValue({ status: "run_requested" }),
    transitionQueue: vi.fn().mockResolvedValue({ paused: true }),
    updateImportManifest: vi.fn().mockResolvedValue({ id: "m1" })
  };
  return { adminAuth, controller: new OperationsController(adminAuth as never, ops as never), ops };
}

describe("OperationsController Sweep-C RBAC", () => {
  it("denies pauseQueue without write perm", async () => {
    const { controller } = build({ read: true, write: false });
    await expect(
      controller.pauseQueue({} as never, { queueName: "audio.export", reason: "ops drill" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects drainQueue without typed-confirmation === queueName", async () => {
    const { controller } = build({ read: true, write: true });
    await expect(
      controller.drainQueue({} as never, {
        queueName: "audio.export",
        reason: "ops drill",
        confirmation: "wrong"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows drainQueue with confirmation === queueName", async () => {
    const { controller, ops } = build({ read: true, write: true });
    await controller.drainQueue({} as never, {
      queueName: "audio.export",
      reason: "ops drill",
      confirmation: "audio.export"
    });
    expect(ops.transitionQueue).toHaveBeenCalledWith(
      expect.objectContaining({ action: "drain", queueName: "audio.export" })
    );
  });

  it("denies markReleaseKnownGood without write perm", async () => {
    const { controller } = build({ read: true, write: false });
    await expect(
      controller.markReleaseKnownGood({} as never, {
        version: "1.2.3",
        confirmation: "1.2.3",
        reason: "post-deploy review"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects markReleaseKnownGood without confirmation match", async () => {
    const { controller } = build({ read: true, write: true });
    await expect(
      controller.markReleaseKnownGood({} as never, { version: "1.2.3", confirmation: "x", reason: "post-deploy" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("denies prepareRollback without write perm", async () => {
    const { controller } = build({ read: true, write: false });
    await expect(
      controller.prepareRollback({} as never, {
        targetVersion: "1.2.2",
        confirmation: "1.2.2",
        reason: "rollback to last good"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects partialReindex with unsupported contentType", async () => {
    const { controller } = build({ read: true, write: true });
    await expect(
      controller.partialReindex({} as never, { contentType: "bogus", reason: "rebuild" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows partialReindex for lexeme with reason", async () => {
    const { controller, ops } = build({ read: true, write: true });
    await controller.partialReindex({} as never, { contentType: "lexeme", reason: "rebuild" });
    expect(ops.partialReindex).toHaveBeenCalled();
  });

  it("denies retryImportError without write perm", async () => {
    const { controller } = build({ read: true, write: false });
    await expect(
      controller.retryImportError({} as never, "11111111-1111-4111-8111-111111111111", { reason: "retry" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("denies bulkImportErrorAction without write perm", async () => {
    const { controller } = build({ read: true, write: false });
    await expect(
      controller.bulkImportErrorAction({} as never, {
        ids: ["11111111-1111-4111-8111-111111111111"],
        action: "retry",
        reason: "bulk retry"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("denies createImportManifest without write perm", async () => {
    const { controller } = build({ read: true, write: false });
    await expect(
      controller.createImportManifest({} as never, {
        sourceType: "kuromoji",
        targetType: "lexeme",
        mapping: { foo: "bar" },
        reason: "wire new source"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("denies runImportManifest without write perm", async () => {
    const { controller } = build({ read: true, write: false });
    await expect(
      controller.runImportManifest({} as never, "11111111-1111-4111-8111-111111111111", { reason: "run" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows importOverview/bjtDashboard/queueActions/releaseHistory with read perm", async () => {
    const { controller, ops } = build({ read: true, write: false });
    await controller.importOverview({} as never);
    await controller.bjtDashboard({} as never);
    await controller.queueActions({} as never, undefined, undefined);
    await controller.releaseHistory({} as never, undefined);
    expect(ops.importOverview).toHaveBeenCalled();
    expect(ops.bjtDashboard).toHaveBeenCalled();
    expect(ops.listQueueActions).toHaveBeenCalled();
    expect(ops.listReleaseEvents).toHaveBeenCalled();
  });

  it("denies read endpoints without read perm", async () => {
    const { controller } = build({ read: false, write: false });
    await expect(controller.importOverview({} as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.bjtDashboard({} as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.releaseHistory({} as never, undefined)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
