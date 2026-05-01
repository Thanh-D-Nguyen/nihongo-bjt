import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { AdminController } from "./admin.controller.js";

describe("AdminController IAM RBAC denial paths", () => {
  function createController(overrides?: {
    requireOneOfPermissions?: ReturnType<typeof vi.fn>;
    requirePermission?: ReturnType<typeof vi.fn>;
  }) {
    const adminAuth = {
      loadAdminPrincipal: vi.fn(),
      requireAdminPortalSession: vi.fn(),
      requireOneOfPermissions:
        overrides?.requireOneOfPermissions ??
        vi.fn().mockRejectedValue(new ForbiddenException("forbidden")),
      requirePermission:
        overrides?.requirePermission ??
        vi.fn().mockRejectedValue(new ForbiddenException("forbidden"))
    };
    const adminRepository = {
      iamAdminAssignRole: vi.fn(),
      iamAdminDetail: vi.fn(),
      iamAdminPatchStatus: vi.fn(),
      iamAdminRevokeRole: vi.fn(),
      iamAdmins: vi.fn(),
      iamPermissions: vi.fn(),
      iamPermissionDetail: vi.fn(),
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

    await expect(controller.iamAdmins({} as any, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, ["iam.manage", "viewer.audit"]);
    expect(adminRepository.iamAdmins).not.toHaveBeenCalled();
  });

  it("denies iamRoleAudit without required read permission", async () => {
    const { controller, adminAuth, adminRepository } = createController();

    await expect(controller.iamRoleAudit({} as any, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, ["iam.manage", "viewer.audit"]);
    expect(adminRepository.iamRoleAudit).not.toHaveBeenCalled();
  });

  it("denies iamAdminDetail without required read permission", async () => {
    const { controller, adminRepository } = createController();
    await expect(
      controller.iamAdminDetail({} as any, "00000000-0000-4000-8000-000000000001")
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminRepository.iamAdminDetail).not.toHaveBeenCalled();
  });

  it("denies iamPermissionDetail without required read permission", async () => {
    const { controller, adminAuth, adminRepository } = createController();
    await expect(controller.iamPermissionDetail({} as any, "iam.manage")).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, ["iam.manage", "viewer.audit"]);
    expect(adminRepository.iamPermissionDetail).not.toHaveBeenCalled();
  });

  it("allows iamPermissions for viewer.audit (read-only catalog)", async () => {
    const { controller, adminAuth, adminRepository } = createController({
      requireOneOfPermissions: vi.fn().mockResolvedValue({ actorId: "ok", permissions: ["viewer.audit"] })
    });
    (adminRepository.iamPermissions as any).mockResolvedValueOnce([]);
    await controller.iamPermissions({} as any);
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, ["iam.manage", "viewer.audit"]);
    expect(adminRepository.iamPermissions).toHaveBeenCalled();
  });

  it("allows iamPermissionDetail for iam.manage and validates code param", async () => {
    const { controller, adminRepository } = createController({
      requireOneOfPermissions: vi.fn().mockResolvedValue({ actorId: "ok", permissions: ["iam.manage"] })
    });
    (adminRepository.iamPermissionDetail as any).mockResolvedValueOnce({
      adminCount: 0,
      admins: [],
      adminsTruncated: false,
      code: "iam.manage",
      group: "iam",
      roles: []
    });
    const out = await controller.iamPermissionDetail({} as any, "iam.manage");
    expect(adminRepository.iamPermissionDetail).toHaveBeenCalledWith("iam.manage");
    expect(out.code).toBe("iam.manage");
  });

  it("allows iamRoleAudit with filter query for viewer.audit", async () => {
    const { controller, adminAuth, adminRepository } = createController({
      requireOneOfPermissions: vi.fn().mockResolvedValue({ actorId: "ok", permissions: ["viewer.audit"] })
    });
    (adminRepository.iamRoleAudit as any).mockResolvedValueOnce({
      items: [],
      page: 1,
      pageSize: 50,
      total: 0
    });
    await controller.iamRoleAudit({} as any, {
      action: "role_assigned",
      page: "1",
      pageSize: "50",
      q: "rotation"
    });
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalledWith({}, ["iam.manage", "viewer.audit"]);
    const callArg = (adminRepository.iamRoleAudit as any).mock.calls[0][0];
    expect(callArg.action).toBe("role_assigned");
    expect(callArg.q).toBe("rotation");
    expect(callArg.page).toBe(1);
    expect(callArg.pageSize).toBe(50);
  });
});

describe("AdminController IAM admin mutation RBAC", () => {
  /** viewer.audit can read but not mutate; iam.manage is mandatory for assign/revoke/status. */
  function createController(opts: { canManage: boolean }) {
    const requirePermission = vi.fn().mockImplementation(async (_req: unknown, perm: string) => {
      if (perm === "iam.manage" && !opts.canManage) {
        throw new ForbiddenException("forbidden");
      }
      return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["iam.manage"] };
    });
    const adminAuth = {
      loadAdminPrincipal: vi.fn(),
      requireAdminPortalSession: vi.fn(),
      requireOneOfPermissions: vi.fn().mockResolvedValue({ actorId: "ok", permissions: [] }),
      requirePermission
    };
    const adminRepository = {
      iamAdminAssignRole: vi.fn().mockResolvedValue({ id: "x" }),
      iamAdminDetail: vi.fn(),
      iamAdminPatchStatus: vi.fn().mockResolvedValue({ id: "x" }),
      iamAdminRevokeRole: vi.fn().mockResolvedValue({ id: "x" }),
      iamAdmins: vi.fn(),
      iamPermissions: vi.fn(),
      iamPermissionDetail: vi.fn(),
      iamRoleAudit: vi.fn(),
      iamRoles: vi.fn()
    };
    const adminUserInvite = { inviteOrCreate: vi.fn() };
    return {
      adminAuth,
      adminRepository,
      controller: new AdminController(adminAuth as any, adminRepository as any, adminUserInvite as any)
    };
  }

  const validBody = { roleCode: "support.t1", reason: "rotation T1" };
  const targetId = "22222222-2222-4222-8222-222222222222";

  it("allows assign role for iam.manage with valid Zod body", async () => {
    const { controller, adminRepository } = createController({ canManage: true });
    await controller.iamAdminAssignRole({} as any, targetId, validBody);
    expect(adminRepository.iamAdminAssignRole).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      targetId,
      "support.t1",
      "rotation T1"
    );
  });

  it("denies assign role without iam.manage", async () => {
    const { controller, adminRepository } = createController({ canManage: false });
    await expect(
      controller.iamAdminAssignRole({} as any, targetId, validBody)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminRepository.iamAdminAssignRole).not.toHaveBeenCalled();
  });

  it("denies revoke role without iam.manage", async () => {
    const { controller, adminRepository } = createController({ canManage: false });
    await expect(
      controller.iamAdminRevokeRole({} as any, targetId, "support.t1", { reason: "removed" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminRepository.iamAdminRevokeRole).not.toHaveBeenCalled();
  });

  it("denies status patch without iam.manage", async () => {
    const { controller, adminRepository } = createController({ canManage: false });
    await expect(
      controller.iamAdminPatchStatus({} as any, targetId, { reason: "leaving", status: "disabled" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminRepository.iamAdminPatchStatus).not.toHaveBeenCalled();
  });
});
