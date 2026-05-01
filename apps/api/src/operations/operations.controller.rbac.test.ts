import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { OperationsController, isHighRiskFlagKey } from "./operations.controller.js";

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
    const ops = { listDeadLettersFiltered: vi.fn() };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await expect(controller.deadLetters({} as any, { status: "open" })).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, ["viewer.audit", "iam.manage"]);
    expect(ops.listDeadLettersFiltered).not.toHaveBeenCalled();
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

describe("OperationsController high-risk confirmation enforcement", () => {
  it("classifies monetization/auth/billing/security/rate_limit/kill-switch keys as high-risk", () => {
    expect(isHighRiskFlagKey("monetization.paywall_enabled")).toBe(true);
    expect(isHighRiskFlagKey("auth.session_timeout_minutes")).toBe(true);
    expect(isHighRiskFlagKey("billing.stripe_webhook")).toBe(true);
    expect(isHighRiskFlagKey("security.cors_strict")).toBe(true);
    expect(isHighRiskFlagKey("api.rate_limit_per_minute")).toBe(true);
    expect(isHighRiskFlagKey("media.kill_switch")).toBe(true);
    expect(isHighRiskFlagKey("misc.notes")).toBe(false);
    expect(isHighRiskFlagKey("misc.notes", true)).toBe(true);
  });

  it("rejects updateFlag for high-risk key without confirmation === key", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn(),
      requirePermission: vi
        .fn()
        .mockResolvedValue({ actorId: "11111111-1111-4111-8111-111111111111", permissions: ["iam.manage"] })
    };
    const ops = { updateFeatureFlag: vi.fn() };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await expect(
      controller.updateFlag({} as any, "monetization.paywall_enabled", {
        enabled: true,
        reason: "rollout"
      })
    ).rejects.toMatchObject({ response: { code: "high_risk_confirmation_required" } });
    expect(ops.updateFeatureFlag).not.toHaveBeenCalled();
  });

  it("rejects updateFlag when confirmation does not match key", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn(),
      requirePermission: vi.fn().mockResolvedValue({ actorId: "x", permissions: ["iam.manage"] })
    };
    const ops = { updateFeatureFlag: vi.fn() };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await expect(
      controller.updateFlag({} as any, "auth.mfa_required", {
        enabled: true,
        confirmation: "wrong",
        reason: "rollout"
      })
    ).rejects.toMatchObject({ response: { code: "high_risk_confirmation_required" } });
    expect(ops.updateFeatureFlag).not.toHaveBeenCalled();
  });

  it("allows updateFlag for high-risk key when confirmation === key", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn(),
      requirePermission: vi
        .fn()
        .mockResolvedValue({ actorId: "11111111-1111-4111-8111-111111111111", permissions: ["iam.manage"] })
    };
    const ops = { updateFeatureFlag: vi.fn().mockResolvedValue({ key: "auth.mfa_required" }) };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await controller.updateFlag({} as any, "auth.mfa_required", {
      enabled: true,
      confirmation: "auth.mfa_required",
      reason: "rollout"
    });
    expect(ops.updateFeatureFlag).toHaveBeenCalledTimes(1);
  });

  it("allows updateFlag for non-high-risk key without confirmation", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn(),
      requirePermission: vi.fn().mockResolvedValue({ actorId: "x", permissions: ["iam.manage"] })
    };
    const ops = { updateFeatureFlag: vi.fn().mockResolvedValue({ key: "misc.notes" }) };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await controller.updateFlag({} as any, "misc.notes", { enabled: false, reason: "tweak" });
    expect(ops.updateFeatureFlag).toHaveBeenCalledTimes(1);
  });

  it("rejects updateKillSwitch without confirmation === key", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn(),
      requirePermission: vi.fn().mockResolvedValue({ actorId: "x", permissions: ["iam.manage"] })
    };
    const ops = { updateFeatureFlag: vi.fn() };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await expect(
      controller.updateKillSwitch({} as any, "external_media_uploads", {
        enabled: false,
        reason: "emergency stop"
      })
    ).rejects.toMatchObject({ response: { code: "high_risk_confirmation_required" } });
    expect(ops.updateFeatureFlag).not.toHaveBeenCalled();
  });

  it("allows updateKillSwitch when confirmation === key", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn(),
      requirePermission: vi.fn().mockResolvedValue({ actorId: "x", permissions: ["iam.manage"] })
    };
    const ops = { updateFeatureFlag: vi.fn().mockResolvedValue({ key: "external_media_uploads" }) };
    const controller = new OperationsController(adminAuth as any, ops as any);

    await controller.updateKillSwitch({} as any, "external_media_uploads", {
      confirmation: "external_media_uploads",
      enabled: false,
      reason: "emergency stop"
    });
    expect(ops.updateFeatureFlag).toHaveBeenCalledTimes(1);
  });
});
