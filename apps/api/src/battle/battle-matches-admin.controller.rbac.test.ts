import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { BattleMatchesAdminController } from "./battle-matches-admin.controller.js";

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
    abort: vi.fn().mockResolvedValue({ id: "x", status: "abandoned" }),
    detail: vi.fn().mockResolvedValue({ audit: [], id: "x", status: "in_progress" }),
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    rerun: vi.fn().mockResolvedValue({ id: "y", status: "in_progress" })
  };
  return { auth, controller: new BattleMatchesAdminController(auth as never, repo as never), repo };
}

const targetId = "22222222-2222-4222-8222-222222222222";
const validReason = { reason: "ops abort blocked match" };

describe("BattleMatchesAdminController RBAC", () => {
  it("denies list without read perms", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: false });
    await expect(controller.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.list).not.toHaveBeenCalled();
  });

  it("allows list for viewer.audit", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await controller.list({} as never, { status: "completed", page: "1", pageSize: "25" });
    expect(repo.list).toHaveBeenCalled();
    expect(repo.list.mock.calls[0]?.[0]?.status).toBe("completed");
  });

  it("denies detail without read perms", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: false });
    await expect(controller.detail({} as never, targetId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.detail).not.toHaveBeenCalled();
  });

  it("denies abort without battle.manage", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(controller.abort({} as never, targetId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(repo.abort).not.toHaveBeenCalled();
  });

  it("allows abort with battle.manage", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await controller.abort({} as never, targetId, validReason);
    expect(repo.abort).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      targetId,
      expect.objectContaining({ reason: "ops abort blocked match" })
    );
  });

  it("rejects abort with too-short reason (Zod)", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await expect(controller.abort({} as never, targetId, { reason: "x" })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(repo.abort).not.toHaveBeenCalled();
  });

  it("denies rerun without battle.manage", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(controller.rerun({} as never, targetId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(repo.rerun).not.toHaveBeenCalled();
  });

  it("allows rerun with battle.manage", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await controller.rerun({} as never, targetId, validReason);
    expect(repo.rerun).toHaveBeenCalled();
  });
});
