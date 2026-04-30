import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { AdminController } from "./admin.controller.js";

describe("AdminController IAM RBAC denial paths", () => {
  function createController() {
    const adminAuth = {
      loadAdminPrincipal: vi.fn(),
      requireAdminPortalSession: vi.fn(),
      requireOneOfPermissions: vi.fn().mockRejectedValue(new ForbiddenException("forbidden")),
      requirePermission: vi.fn()
    };
    const adminRepository = {
      iamAdmins: vi.fn(),
      iamPermissions: vi.fn(),
      iamRoleAudit: vi.fn(),
      iamRoles: vi.fn()
    };
    const adminUserInvite = {
      inviteOrCreate: vi.fn()
    };

    return {
      adminAuth,
      adminRepository,
      controller: new AdminController(adminAuth as any, adminRepository as any, adminUserInvite as any)
    };
  }

  it("denies iamRoles without required read permission", async () => {
    const { controller, adminAuth, adminRepository } = createController();

    await expect(controller.iamRoles({} as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, ["iam.manage", "viewer.audit"]);
    expect(adminRepository.iamRoles).not.toHaveBeenCalled();
  });

  it("denies iamPermissions without required read permission", async () => {
    const { controller, adminAuth, adminRepository } = createController();

    await expect(controller.iamPermissions({} as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, ["iam.manage", "viewer.audit"]);
    expect(adminRepository.iamPermissions).not.toHaveBeenCalled();
  });

  it("denies iamAdmins without required read permission", async () => {
    const { controller, adminAuth, adminRepository } = createController();

    await expect(controller.iamAdmins({} as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, ["iam.manage", "viewer.audit"]);
    expect(adminRepository.iamAdmins).not.toHaveBeenCalled();
  });

  it("denies iamRoleAudit without required read permission", async () => {
    const { controller, adminAuth, adminRepository } = createController();

    await expect(controller.iamRoleAudit({} as any, "25")).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, ["iam.manage", "viewer.audit"]);
    expect(adminRepository.iamRoleAudit).not.toHaveBeenCalled();
  });
});
