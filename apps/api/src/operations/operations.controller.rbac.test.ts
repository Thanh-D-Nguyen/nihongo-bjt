import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { OperationsController } from "./operations.controller.js";

describe("OperationsController RBAC denial paths", () => {
  it("denies listFlags when read permission is missing", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn().mockRejectedValue(new ForbiddenException("forbidden")),
      requirePermission: vi.fn()
    };
    const ops = { listFeatureFlags: vi.fn() };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await expect(controller.listFlags({} as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, ["iam.manage", "viewer.audit"]);
    expect(ops.listFeatureFlags).not.toHaveBeenCalled();
  });

  it("denies updateFlag for unauthenticated admin actor", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn(),
      requirePermission: vi.fn().mockRejectedValue(new UnauthorizedException("unauthenticated"))
    };
    const ops = { updateFeatureFlag: vi.fn() };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await expect(
      controller.updateFlag({} as any, "social_growth", {
        enabled: true,
        reason: "security rollout"
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(adminAuth.requirePermission).toHaveBeenCalledWith({}, "iam.manage");
    expect(ops.updateFeatureFlag).not.toHaveBeenCalled();
  });

  it("denies killSwitches when read permission is missing", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn().mockRejectedValue(new ForbiddenException("forbidden")),
      requirePermission: vi.fn()
    };
    const ops = { listFeatureFlags: vi.fn() };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await expect(controller.killSwitches({} as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, ["iam.manage", "viewer.audit"]);
    expect(ops.listFeatureFlags).not.toHaveBeenCalled();
  });

  it("denies updateKillSwitch when write permission is missing", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn(),
      requirePermission: vi.fn().mockRejectedValue(new ForbiddenException("forbidden"))
    };
    const ops = { updateFeatureFlag: vi.fn() };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await expect(
      controller.updateKillSwitch({} as any, "external_media_uploads", {
        reason: "emergency stop"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requirePermission).toHaveBeenCalledWith({}, "iam.manage");
    expect(ops.updateFeatureFlag).not.toHaveBeenCalled();
  });

  it("denies deadLetters when read permission is missing", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn().mockRejectedValue(new ForbiddenException("forbidden")),
      requirePermission: vi.fn()
    };
    const ops = { listDeadLetters: vi.fn() };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await expect(controller.deadLetters({} as any, "open")).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, ["viewer.audit", "iam.manage"]);
    expect(ops.listDeadLetters).not.toHaveBeenCalled();
  });

  it("denies systemHealth when read permission is missing", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn().mockRejectedValue(new ForbiddenException("forbidden")),
      requirePermission: vi.fn()
    };
    const ops = { systemHealthSummary: vi.fn() };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await expect(controller.systemHealth({} as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, ["iam.manage", "viewer.audit"]);
    expect(ops.systemHealthSummary).not.toHaveBeenCalled();
  });

  it("denies queueHealth when read permission is missing", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn().mockRejectedValue(new ForbiddenException("forbidden")),
      requirePermission: vi.fn()
    };
    const ops = { queueHealthSummary: vi.fn() };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await expect(controller.queueHealth({} as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, ["iam.manage", "viewer.audit"]);
    expect(ops.queueHealthSummary).not.toHaveBeenCalled();
  });

  it("denies notificationsSummary when read permission is missing", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn().mockRejectedValue(new ForbiddenException("forbidden")),
      requirePermission: vi.fn()
    };
    const ops = { notificationsSummary: vi.fn() };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await expect(controller.notificationsSummary({} as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, ["viewer.audit", "iam.manage"]);
    expect(ops.notificationsSummary).not.toHaveBeenCalled();
  });

  it("denies securitySummary when read permission is missing", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn().mockRejectedValue(new ForbiddenException("forbidden")),
      requirePermission: vi.fn()
    };
    const ops = { securitySummary: vi.fn() };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await expect(controller.securitySummary({} as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, ["viewer.audit", "iam.manage"]);
    expect(ops.securitySummary).not.toHaveBeenCalled();
  });

  it("denies resolveDeadLetter when write permission is missing", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn(),
      requirePermission: vi.fn().mockRejectedValue(new ForbiddenException("forbidden"))
    };
    const ops = { resolveDeadLetter: vi.fn() };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await expect(
      controller.resolveDeadLetter({} as any, "dlq-id", {
        reason: "cleanup",
        status: "resolved"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requirePermission).toHaveBeenCalledWith({}, "iam.manage");
    expect(ops.resolveDeadLetter).not.toHaveBeenCalled();
  });

  it("denies importStagingErrors when read permission is missing", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn().mockRejectedValue(new ForbiddenException("forbidden")),
      requirePermission: vi.fn()
    };
    const ops = { listImportStagingErrors: vi.fn() };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await expect(controller.importStagingErrors({} as any, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, ["viewer.audit", "iam.manage"]);
    expect(ops.listImportStagingErrors).not.toHaveBeenCalled();
  });

  it("denies escalateImportErrorToDeadLetter when write permission is missing", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn(),
      requirePermission: vi.fn().mockRejectedValue(new ForbiddenException("forbidden"))
    };
    const ops = { escalateImportErrorToDeadLetter: vi.fn() };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await expect(
      controller.escalateImportErrorToDeadLetter({} as any, "import-error-1", {
        reason: "retain for retry"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requirePermission).toHaveBeenCalledWith({}, "iam.manage");
    expect(ops.escalateImportErrorToDeadLetter).not.toHaveBeenCalled();
  });

  it("denies rebuildSearchProjection when write permission is missing", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn(),
      requirePermission: vi.fn().mockRejectedValue(new ForbiddenException("forbidden"))
    };
    const ops = { rebuildSearchProjection: vi.fn() };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await expect(
      controller.rebuildSearchProjection({} as any, {
        reason: "rebuild after import"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requirePermission).toHaveBeenCalledWith({}, "iam.manage");
    expect(ops.rebuildSearchProjection).not.toHaveBeenCalled();
  });
});
