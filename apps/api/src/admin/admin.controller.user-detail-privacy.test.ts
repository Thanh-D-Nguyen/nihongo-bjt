import { describe, expect, it, vi } from "vitest";
import { ADMIN_PERMISSION } from "@nihongo-bjt/shared";

import { AdminController } from "./admin.controller.js";

function reqWithReason(extra: Record<string, string> = {}) {
  return {
    headers: {
      "x-admin-access-reason": "Investigating support ticket #1234",
      "x-admin-access-reason-category": "support",
      ...extra
    }
  } as unknown as import("express").Request;
}

describe("AdminController userDetail privacy boundary", () => {
  it("returns redacted detail for support read without sensitive permission", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn().mockResolvedValue({
        actorId: "actor-1",
        permissions: new Set([ADMIN_PERMISSION.supportUserRead])
      })
    };
    const adminRepository = {
      recordUserDetailAccess: vi.fn().mockResolvedValue(undefined),
      userConsoleDetail: vi.fn().mockResolvedValue({ ok: true })
    };

    const controller = new AdminController(
      adminAuth as never,
      adminRepository as never,
      {} as never
    );

    await controller.userDetail(reqWithReason(), "user-1");

    expect(adminRepository.recordUserDetailAccess).toHaveBeenCalledWith(
      "actor-1",
      "user-1",
      false,
      { category: "support", reason: "Investigating support ticket #1234" }
    );
    expect(adminRepository.userConsoleDetail).toHaveBeenCalledWith("user-1", {
      includeSensitive: false
    });
  });

  it("allows sensitive detail when sensitive permission exists", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn().mockResolvedValue({
        actorId: "actor-2",
        permissions: new Set([ADMIN_PERMISSION.supportUserSensitiveRead])
      })
    };
    const adminRepository = {
      recordUserDetailAccess: vi.fn().mockResolvedValue(undefined),
      userConsoleDetail: vi.fn().mockResolvedValue({ ok: true })
    };

    const controller = new AdminController(
      adminAuth as never,
      adminRepository as never,
      {} as never
    );

    await controller.userDetail(reqWithReason(), "user-2");

    expect(adminRepository.recordUserDetailAccess).toHaveBeenCalledWith(
      "actor-2",
      "user-2",
      true,
      { category: "support", reason: "Investigating support ticket #1234" }
    );
    expect(adminRepository.userConsoleDetail).toHaveBeenCalledWith("user-2", {
      includeSensitive: true
    });
  });

  it("rejects 403 when access reason header is missing", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn().mockResolvedValue({
        actorId: "actor-3",
        permissions: new Set([ADMIN_PERMISSION.supportUserRead])
      })
    };
    const adminRepository = {
      recordUserDetailAccess: vi.fn(),
      userConsoleDetail: vi.fn()
    };

    const controller = new AdminController(
      adminAuth as never,
      adminRepository as never,
      {} as never
    );

    const reqNoReason = { headers: {} } as unknown as import("express").Request;
    await expect(controller.userDetail(reqNoReason, "user-3")).rejects.toMatchObject({
      response: { code: "access_reason_required" }
    });
    expect(adminRepository.recordUserDetailAccess).not.toHaveBeenCalled();
    expect(adminRepository.userConsoleDetail).not.toHaveBeenCalled();
  });

  it("rejects 403 when access reason is too short", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn().mockResolvedValue({
        actorId: "actor-4",
        permissions: new Set([ADMIN_PERMISSION.supportUserRead])
      })
    };
    const adminRepository = {
      recordUserDetailAccess: vi.fn(),
      userConsoleDetail: vi.fn()
    };

    const controller = new AdminController(
      adminAuth as never,
      adminRepository as never,
      {} as never
    );

    const shortReq = {
      headers: {
        "x-admin-access-reason": "abc",
        "x-admin-access-reason-category": "support"
      }
    } as unknown as import("express").Request;

    await expect(controller.userDetail(shortReq, "user-4")).rejects.toMatchObject({
      response: { code: "access_reason_required" }
    });
  });

  it("rejects 403 when access reason category is invalid", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn().mockResolvedValue({
        actorId: "actor-5",
        permissions: new Set([ADMIN_PERMISSION.supportUserRead])
      })
    };
    const adminRepository = {
      recordUserDetailAccess: vi.fn(),
      userConsoleDetail: vi.fn()
    };

    const controller = new AdminController(
      adminAuth as never,
      adminRepository as never,
      {} as never
    );

    const badCat = {
      headers: {
        "x-admin-access-reason": "Looking into refund pattern",
        "x-admin-access-reason-category": "curiosity"
      }
    } as unknown as import("express").Request;

    await expect(controller.userDetail(badCat, "user-5")).rejects.toMatchObject({
      response: { code: "access_reason_category_required" }
    });
  });

  it("audit endpoint also requires access reason", async () => {
    const adminAuth = {
      requireOneOfPermissions: vi.fn().mockResolvedValue({
        actorId: "actor-6",
        permissions: new Set([ADMIN_PERMISSION.supportUserRead])
      })
    };
    const adminRepository = {
      userAuditForTarget: vi.fn().mockResolvedValue([])
    };

    const controller = new AdminController(
      adminAuth as never,
      adminRepository as never,
      {} as never
    );

    const noReason = { headers: {} } as unknown as import("express").Request;
    await expect(
      controller.userAudit(noReason, "user-6", undefined)
    ).rejects.toMatchObject({ response: { code: "access_reason_required" } });

    await controller.userAudit(reqWithReason(), "user-6", "20");
    expect(adminRepository.userAuditForTarget).toHaveBeenCalledWith("user-6", 20);
  });
});
