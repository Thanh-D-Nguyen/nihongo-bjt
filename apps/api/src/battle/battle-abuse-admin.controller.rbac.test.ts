import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { BattleAbuseAdminController } from "./battle-abuse-admin.controller.js";

function createController(opts: { canManage: boolean; canRead: boolean }) {
  const requirePermission = vi.fn().mockImplementation(async (_req: unknown, perm: string) => {
    if (perm === "battle.manage" && !opts.canManage) throw new ForbiddenException("forbidden");
    return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["battle.manage"] };
  });
  const requireOneOfPermissions = vi.fn().mockImplementation(async () => {
    if (!opts.canRead) throw new ForbiddenException("forbidden");
    return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["viewer.audit"] };
  });
  const auth = { requireOneOfPermissions, requirePermission };
  const repo = {
    detail: vi.fn().mockResolvedValue({ audit: [], id: "x", priorAgainstSubject: [], status: "open" }),
    escalate: vi.fn().mockResolvedValue({ id: "x", status: "escalated" }),
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    resolve: vi.fn().mockResolvedValue({ id: "x", status: "resolved" })
  };
  return {
    auth,
    controller: new BattleAbuseAdminController(auth as never, repo as never),
    repo
  };
}

const targetId = "22222222-2222-4222-8222-222222222222";
const validResolve = {
  action: "warning",
  notes: "First-time soft warning issued",
  reason: "Mild offense, first occurrence"
};
const validEscalate = { reason: "Repeated harassment, escalating to legal" };

describe("BattleAbuseAdminController RBAC", () => {
  it("denies list without read perms", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: false });
    await expect(controller.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.list).not.toHaveBeenCalled();
  });

  it("allows list for viewer.audit", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await controller.list({} as never, { status: "open" });
    expect(repo.list).toHaveBeenCalled();
    expect(repo.list.mock.calls[0]?.[0]?.status).toBe("open");
  });

  it("denies detail without read perms", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: false });
    await expect(controller.detail({} as never, targetId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.detail).not.toHaveBeenCalled();
  });

  it("denies resolve without battle.manage", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(controller.resolve({} as never, targetId, validResolve)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(repo.resolve).not.toHaveBeenCalled();
  });

  it("allows resolve with battle.manage", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await controller.resolve({} as never, targetId, validResolve);
    expect(repo.resolve).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      targetId,
      expect.objectContaining({ action: "warning", notes: "First-time soft warning issued" })
    );
  });

  it("rejects resolve with invalid action (Zod)", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await expect(
      controller.resolve({} as never, targetId, { ...validResolve, action: "nuke" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.resolve).not.toHaveBeenCalled();
  });

  it("denies escalate without battle.manage", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(controller.escalate({} as never, targetId, validEscalate)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(repo.escalate).not.toHaveBeenCalled();
  });

  it("allows escalate with battle.manage", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await controller.escalate({} as never, targetId, validEscalate);
    expect(repo.escalate).toHaveBeenCalled();
  });

  it("rejects escalate with too-short reason (Zod)", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await expect(controller.escalate({} as never, targetId, { reason: "x" })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(repo.escalate).not.toHaveBeenCalled();
  });
});
