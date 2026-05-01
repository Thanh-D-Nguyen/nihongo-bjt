import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { GrowthReferralsAdminController } from "./growth-referrals-admin.controller.js";

function createController(opts: { canManage: boolean; canRead: boolean }) {
  const requirePermission = vi.fn().mockImplementation(async (_req: unknown, perm: string) => {
    if (perm === "growth.manage" && !opts.canManage) {
      throw new ForbiddenException("forbidden");
    }
    return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["growth.manage"] };
  });
  const requireOneOfPermissions = vi.fn().mockImplementation(async () => {
    if (!opts.canRead) throw new ForbiddenException("forbidden");
    return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["viewer.audit"] };
  });
  const auth = { requireOneOfPermissions, requirePermission };
  const repo = {
    detail: vi.fn().mockResolvedValue({ audit: [], events: [], id: "x" }),
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    revoke: vi.fn().mockResolvedValue({ id: "x", revoked: true })
  };
  return {
    auth,
    controller: new GrowthReferralsAdminController(auth as never, repo as never),
    repo
  };
}

const targetId = "22222222-2222-4222-8222-222222222222";
const validReason = { reason: "fraud detected" };

describe("GrowthReferralsAdminController RBAC", () => {
  it("denies list without read perms", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: false });
    await expect(controller.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.list).not.toHaveBeenCalled();
  });
  it("allows list for viewer.audit", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await controller.list({} as never, { flagged: "true" });
    expect(repo.list).toHaveBeenCalled();
    expect(repo.list.mock.calls[0]?.[0]).toMatchObject({ flagged: true });
  });
  it("denies revoke without growth.manage", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(controller.revoke({} as never, targetId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(repo.revoke).not.toHaveBeenCalled();
  });
  it("allows revoke with growth.manage", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await controller.revoke({} as never, targetId, validReason);
    expect(repo.revoke).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      targetId,
      "fraud detected"
    );
  });
  it("rejects revoke with too-short reason", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await expect(controller.revoke({} as never, targetId, { reason: "x" })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(repo.revoke).not.toHaveBeenCalled();
  });
});
