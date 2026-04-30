import { describe, expect, it, vi } from "vitest";
import { ADMIN_PERMISSION } from "@nihongo-bjt/shared";

import { AdminController } from "./admin.controller.js";

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
      adminAuth as any,
      adminRepository as any,
      {} as any
    );

    await controller.userDetail({} as any, "user-1");

    expect(adminRepository.recordUserDetailAccess).toHaveBeenCalledWith("actor-1", "user-1", false);
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
      adminAuth as any,
      adminRepository as any,
      {} as any
    );

    await controller.userDetail({} as any, "user-2");

    expect(adminRepository.recordUserDetailAccess).toHaveBeenCalledWith("actor-2", "user-2", true);
    expect(adminRepository.userConsoleDetail).toHaveBeenCalledWith("user-2", {
      includeSensitive: true
    });
  });
});
