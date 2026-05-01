import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { OperationsController } from "./operations.controller.js";

/**
 * RBAC denial tests for Sweep B endpoints (DLQ retry/bulk, feature flag history,
 * security events, broadcast notifications).
 *
 * These exercise the RBAC gate only; success-path business logic is covered by
 * service-level unit tests (out of scope for this slice).
 */

function denyRead() {
  return {
    requireOneOfPermissions: vi.fn().mockRejectedValue(new ForbiddenException("forbidden")),
    requirePermission: vi.fn()
  };
}
function denyWrite() {
  return {
    requireOneOfPermissions: vi.fn(),
    requirePermission: vi.fn().mockRejectedValue(new ForbiddenException("forbidden"))
  };
}

describe("OperationsController Sweep B RBAC", () => {
  describe("dead-letter queue extensions", () => {
    it("denies retryDeadLetter when write permission is missing", async () => {
      const auth = denyWrite();
      const ops = { retryDeadLetter: vi.fn() };
      const c = new OperationsController(auth as any, ops as any);
      await expect(
        c.retryDeadLetter({} as any, "id", { reason: "retrying" })
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(auth.requirePermission).toHaveBeenCalledWith({}, "iam.manage");
      expect(ops.retryDeadLetter).not.toHaveBeenCalled();
    });

    it("denies bulkDeadLetter when write permission is missing", async () => {
      const auth = denyWrite();
      const ops = { bulkDeadLetter: vi.fn() };
      const c = new OperationsController(auth as any, ops as any);
      await expect(
        c.bulkDeadLetter({} as any, {
          ids: ["00000000-0000-4000-8000-000000000001"],
          action: "retry",
          reason: "bulk retry"
        })
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(ops.bulkDeadLetter).not.toHaveBeenCalled();
    });

    it("denies deadLetterDetail when read permission is missing", async () => {
      const auth = denyRead();
      const ops = { getDeadLetterDetail: vi.fn() };
      const c = new OperationsController(auth as any, ops as any);
      await expect(c.deadLetterDetail({} as any, "id")).rejects.toBeInstanceOf(ForbiddenException);
      expect(ops.getDeadLetterDetail).not.toHaveBeenCalled();
    });

    it("validates retryDeadLetter reason length", async () => {
      const auth = {
        requireOneOfPermissions: vi.fn(),
        requirePermission: vi.fn().mockResolvedValue({ actorId: "x", permissions: new Set(["iam.manage"]) })
      };
      const ops = { retryDeadLetter: vi.fn() };
      const c = new OperationsController(auth as any, ops as any);
      await expect(c.retryDeadLetter({} as any, "id", { reason: "x" })).rejects.toMatchObject({
        status: 400
      });
      expect(ops.retryDeadLetter).not.toHaveBeenCalled();
    });

    it("validates bulkDeadLetter requires ids and action enum", async () => {
      const auth = {
        requireOneOfPermissions: vi.fn(),
        requirePermission: vi.fn().mockResolvedValue({ actorId: "x", permissions: new Set(["iam.manage"]) })
      };
      const ops = { bulkDeadLetter: vi.fn() };
      const c = new OperationsController(auth as any, ops as any);
      await expect(
        c.bulkDeadLetter({} as any, { ids: [], action: "retry", reason: "ok reason" })
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        c.bulkDeadLetter({} as any, {
          ids: ["00000000-0000-4000-8000-000000000001"],
          action: "delete",
          reason: "ok reason"
        })
      ).rejects.toMatchObject({ status: 400 });
      expect(ops.bulkDeadLetter).not.toHaveBeenCalled();
    });
  });

  describe("feature flag history", () => {
    it("denies featureFlagHistory when read permission is missing", async () => {
      const auth = denyRead();
      const ops = { featureFlagHistory: vi.fn() };
      const c = new OperationsController(auth as any, ops as any);
      await expect(c.featureFlagHistory({} as any, "key", "20")).rejects.toBeInstanceOf(
        ForbiddenException
      );
      expect(ops.featureFlagHistory).not.toHaveBeenCalled();
    });
  });

  describe("security events", () => {
    it("denies securityEvents when read permission is missing", async () => {
      const auth = denyRead();
      const ops = { listSecurityEvents: vi.fn() };
      const c = new OperationsController(auth as any, ops as any);
      await expect(c.securityEvents({} as any, {})).rejects.toBeInstanceOf(ForbiddenException);
      expect(ops.listSecurityEvents).not.toHaveBeenCalled();
    });

    it("denies resolveSecurityEvent when write permission is missing", async () => {
      const auth = denyWrite();
      const ops = { resolveSecurityEvent: vi.fn() };
      const c = new OperationsController(auth as any, ops as any);
      await expect(
        c.resolveSecurityEvent({} as any, "id", { resolution: "resolved", reason: "verified" })
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(ops.resolveSecurityEvent).not.toHaveBeenCalled();
    });

    it("validates resolveSecurityEvent resolution enum", async () => {
      const auth = {
        requireOneOfPermissions: vi.fn(),
        requirePermission: vi.fn().mockResolvedValue({ actorId: "x", permissions: new Set(["iam.manage"]) })
      };
      const ops = { resolveSecurityEvent: vi.fn() };
      const c = new OperationsController(auth as any, ops as any);
      await expect(
        c.resolveSecurityEvent({} as any, "id", { resolution: "ignored", reason: "valid reason" })
      ).rejects.toMatchObject({ status: 400 });
      expect(ops.resolveSecurityEvent).not.toHaveBeenCalled();
    });
  });

  describe("broadcast notifications", () => {
    it("denies listBroadcasts when read permission is missing", async () => {
      const auth = denyRead();
      const ops = { listBroadcasts: vi.fn() };
      const c = new OperationsController(auth as any, ops as any);
      await expect(c.listBroadcasts({} as any, {})).rejects.toBeInstanceOf(ForbiddenException);
      expect(ops.listBroadcasts).not.toHaveBeenCalled();
    });

    it("denies createBroadcast when write permission is missing", async () => {
      const auth = denyWrite();
      const ops = { createBroadcast: vi.fn() };
      const c = new OperationsController(auth as any, ops as any);
      await expect(
        c.createBroadcast({} as any, {
          title: "t",
          body: "b",
          channel: "in_app",
          audience: { locale: ["vi"] },
          reason: "promo"
        })
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(ops.createBroadcast).not.toHaveBeenCalled();
    });

    it("validates createBroadcast required fields and channel enum", async () => {
      const auth = {
        requireOneOfPermissions: vi.fn(),
        requirePermission: vi.fn().mockResolvedValue({ actorId: "x", permissions: new Set(["iam.manage"]) })
      };
      const ops = { createBroadcast: vi.fn() };
      const c = new OperationsController(auth as any, ops as any);
      await expect(
        c.createBroadcast({} as any, {
          title: "t",
          body: "b",
          channel: "sms",
          audience: { locale: ["vi"] },
          reason: "ok reason"
        })
      ).rejects.toMatchObject({ status: 400 });
      expect(ops.createBroadcast).not.toHaveBeenCalled();
    });

    it("denies scheduleBroadcast when write permission is missing", async () => {
      const auth = denyWrite();
      const ops = { transitionBroadcast: vi.fn() };
      const c = new OperationsController(auth as any, ops as any);
      await expect(
        c.scheduleBroadcast({} as any, "id", { reason: "go live" })
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(ops.transitionBroadcast).not.toHaveBeenCalled();
    });

    it("denies cancelBroadcast when write permission is missing", async () => {
      const auth = denyWrite();
      const ops = { transitionBroadcast: vi.fn() };
      const c = new OperationsController(auth as any, ops as any);
      await expect(
        c.cancelBroadcast({} as any, "id", { reason: "abort" })
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(ops.transitionBroadcast).not.toHaveBeenCalled();
    });
  });
});
