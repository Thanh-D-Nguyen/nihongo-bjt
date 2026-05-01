import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { AdminController } from "./admin.controller.js";

/**
 * Sweep B — support notes RBAC + privacy hardening for the global support notes admin route.
 *
 * Privacy contract:
 *  - Reads require one of `support.user.read`, `support.user.write`, `support.user`, `iam.manage`.
 *  - Writes require one of `support.user.write`, `support.user`.
 *  - When the viewer holds `iam.manage`, scope is upgraded to `audit_only` (sees private notes by other authors).
 *  - Otherwise scope is `team_only` and the viewer's actor id is passed so own-private notes are still visible.
 */

function createController(overrides?: {
  requireOneOfPermissions?: ReturnType<typeof vi.fn>;
}) {
  const adminAuth = {
    loadAdminPrincipal: vi.fn(),
    requireAdminPortalSession: vi.fn(),
    requireOneOfPermissions:
      overrides?.requireOneOfPermissions ??
      vi.fn().mockRejectedValue(new ForbiddenException("forbidden")),
    requirePermission: vi.fn().mockRejectedValue(new ForbiddenException("forbidden"))
  };
  const adminRepository = {
    addUserSupportNote: vi.fn().mockResolvedValue({ ok: true, visibility: "team" }),
    supportNotes: vi.fn().mockResolvedValue({ items: [], total: 0 })
  };
  const adminUserInvite = { inviteOrCreate: vi.fn() };
  return {
    adminAuth,
    adminRepository,
    controller: new AdminController(adminAuth as any, adminRepository as any, adminUserInvite as any)
  };
}

describe("AdminController support notes RBAC + privacy", () => {
  it("denies supportNotes list without read permission", async () => {
    const { controller, adminAuth, adminRepository } = createController();
    await expect(controller.supportNotes({} as any, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuth.requireOneOfPermissions).toHaveBeenCalled();
    expect(adminRepository.supportNotes).not.toHaveBeenCalled();
  });

  it("uses team_only scope when viewer has support.user.read but not iam.manage", async () => {
    const { controller, adminRepository } = createController({
      requireOneOfPermissions: vi.fn().mockResolvedValue({
        actorId: "viewer-1",
        permissions: new Set(["support.user.read"])
      })
    });
    await controller.supportNotes({} as any, { limit: "10" });
    expect(adminRepository.supportNotes).toHaveBeenCalledWith(
      expect.objectContaining({
        actorScope: "team_only",
        viewerActorId: "viewer-1"
      })
    );
  });

  it("upgrades to audit_only scope when viewer has iam.manage", async () => {
    const { controller, adminRepository } = createController({
      requireOneOfPermissions: vi.fn().mockResolvedValue({
        actorId: "auditor-1",
        permissions: new Set(["iam.manage"])
      })
    });
    await controller.supportNotes({} as any, {});
    expect(adminRepository.supportNotes).toHaveBeenCalledWith(
      expect.objectContaining({
        actorScope: "audit_only",
        viewerActorId: "auditor-1"
      })
    );
  });

  it("denies createSupportNote without write permission", async () => {
    const { controller, adminRepository } = createController();
    await expect(
      controller.createSupportNote({} as any, {
        userId: "00000000-0000-4000-8000-000000000001",
        body: "note body",
        reason: "follow-up",
        visibility: "private"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminRepository.addUserSupportNote).not.toHaveBeenCalled();
  });

  it("validates createSupportNote body fields", async () => {
    const { controller, adminRepository } = createController({
      requireOneOfPermissions: vi.fn().mockResolvedValue({
        actorId: "writer-1",
        permissions: new Set(["support.user.write"])
      })
    });
    await expect(
      controller.createSupportNote({} as any, {
        userId: "not-a-uuid",
        body: "x",
        reason: "y",
        visibility: "team"
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(adminRepository.addUserSupportNote).not.toHaveBeenCalled();
  });

  it("forwards visibility to repository on valid create", async () => {
    const { controller, adminRepository } = createController({
      requireOneOfPermissions: vi.fn().mockResolvedValue({
        actorId: "writer-1",
        permissions: new Set(["support.user.write"])
      })
    });
    await controller.createSupportNote({} as any, {
      userId: "00000000-0000-4000-8000-000000000099",
      body: "internal note",
      reason: "compliance",
      visibility: "audit_only"
    });
    expect(adminRepository.addUserSupportNote).toHaveBeenCalledWith(
      "writer-1",
      "00000000-0000-4000-8000-000000000099",
      expect.objectContaining({ visibility: "audit_only", reason: "compliance" })
    );
  });
});
