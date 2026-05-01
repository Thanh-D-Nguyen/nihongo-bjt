import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { GrowthPostcardsAdminController } from "./growth-postcards-admin.controller.js";

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
    archive: vi.fn().mockResolvedValue({ id: "x", active: false }),
    create: vi.fn().mockResolvedValue({ id: "x" }),
    detail: vi.fn().mockResolvedValue({ audit: [], id: "x" }),
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    patch: vi.fn().mockResolvedValue({ id: "x" }),
    publish: vi.fn().mockResolvedValue({ id: "x", active: true })
  };
  return {
    auth,
    controller: new GrowthPostcardsAdminController(auth as never, repo as never),
    repo
  };
}

const targetId = "22222222-2222-4222-8222-222222222222";
const validCreate = {
  config: {
    bodyTemplate: "{user_name} hit a {streak_days} day streak!",
    name: "Streak postcard",
    privacyClass: "anonymized",
    surface: "postcard"
  },
  kind: "streak",
  reason: "T1 add",
  slug: "streak-card-v1"
};
const validReason = { reason: "rotate" };

describe("GrowthPostcardsAdminController RBAC", () => {
  it("denies list without read perms", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: false });
    await expect(controller.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.list).not.toHaveBeenCalled();
  });
  it("allows list for viewer.audit", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await controller.list({} as never, { kind: "streak" });
    expect(repo.list).toHaveBeenCalled();
  });
  it("denies create without growth.manage", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(controller.create({} as never, validCreate)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("allows create with growth.manage and Zod-valid body", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await controller.create({} as never, validCreate);
    expect(repo.create).toHaveBeenCalled();
  });
  it("rejects create with config.surface != postcard", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await expect(
      controller.create({} as never, {
        ...validCreate,
        config: { ...validCreate.config, surface: "social" }
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("denies patch without growth.manage", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(
      controller.patch({} as never, targetId, { reason: "rotate" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.patch).not.toHaveBeenCalled();
  });
  it("denies publish without growth.manage", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(controller.publish({} as never, targetId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(repo.publish).not.toHaveBeenCalled();
  });
  it("denies archive without growth.manage", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(controller.archive({} as never, targetId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(repo.archive).not.toHaveBeenCalled();
  });
  it("rejects publish with too-short reason", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await expect(controller.publish({} as never, targetId, { reason: "x" })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(repo.publish).not.toHaveBeenCalled();
  });
});
