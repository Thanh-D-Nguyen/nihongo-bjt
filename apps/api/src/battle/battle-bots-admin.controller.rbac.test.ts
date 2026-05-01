import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { BattleBotsAdminController } from "./battle-bots-admin.controller.js";

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
    archive: vi.fn().mockResolvedValue({ id: "x", status: "archived" }),
    create: vi.fn().mockResolvedValue({ id: "x", status: "active" }),
    detail: vi.fn().mockResolvedValue({ audit: [], id: "x", status: "active" }),
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    patch: vi.fn().mockResolvedValue({ id: "x", status: "active" }),
    remove: vi.fn().mockResolvedValue({ deleted: true, id: "x" }),
    toggle: vi.fn().mockResolvedValue({ id: "x", status: "active" })
  };
  return {
    auth,
    controller: new BattleBotsAdminController(auth as never, repo as never),
    repo
  };
}

const targetId = "22222222-2222-4222-8222-222222222222";
const validCreate = {
  accuracyPct: 75,
  difficulty: "medium",
  maxDelayMs: 4000,
  minDelayMs: 1500,
  name: "Sakura N3",
  persona: "Friendly study partner",
  reason: "Add new N3 bot for evening shift",
  vocabularyLevel: "jlpt_n3"
};
const validReason = { reason: "rotation T1" };

describe("BattleBotsAdminController RBAC", () => {
  it("denies list without read perms", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: false });
    await expect(controller.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.list).not.toHaveBeenCalled();
  });

  it("allows list for viewer.audit", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await controller.list({} as never, { difficulty: "hard" });
    expect(repo.list).toHaveBeenCalled();
    expect(repo.list.mock.calls[0]?.[0]?.difficulty).toBe("hard");
  });

  it("denies create without battle.manage", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(controller.create({} as never, validCreate)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("allows create with battle.manage and validates Zod", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await controller.create({} as never, validCreate);
    expect(repo.create).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      expect.objectContaining({ name: "Sakura N3", difficulty: "medium" })
    );
  });

  it("rejects create when maxDelayMs < minDelayMs (Zod superRefine)", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await expect(
      controller.create({} as never, { ...validCreate, minDelayMs: 5000, maxDelayMs: 1000 })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("denies patch without battle.manage", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(
      controller.patch({} as never, targetId, { name: "x", reason: "rename" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.patch).not.toHaveBeenCalled();
  });

  it("denies enable/disable/archive without battle.manage", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(controller.enable({} as never, targetId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(controller.disable({} as never, targetId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(controller.archive({} as never, targetId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(repo.toggle).not.toHaveBeenCalled();
    expect(repo.archive).not.toHaveBeenCalled();
  });

  it("allows enable with battle.manage", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await controller.enable({} as never, targetId, validReason);
    expect(repo.toggle).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      targetId,
      "rotation T1",
      "active"
    );
  });

  it("denies remove without battle.manage", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(controller.remove({} as never, targetId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it("rejects archive with too-short reason (Zod)", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await expect(
      controller.archive({} as never, targetId, { reason: "x" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.archive).not.toHaveBeenCalled();
  });
});
