import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { CompetenciesAdminController } from "./learning-competencies-admin.controller.js";

function createController(opts: { canManage: boolean; canRead: boolean }) {
  const requirePermission = vi.fn().mockImplementation(async (_req: unknown, perm: string) => {
    if (perm === "admin.content.write" && !opts.canManage) {
      throw new ForbiddenException("forbidden");
    }
    return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["admin.content.write"] };
  });
  const requireOneOfPermissions = vi.fn().mockImplementation(async () => {
    if (!opts.canRead) throw new ForbiddenException("forbidden");
    return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["viewer.audit"] };
  });
  const auth = { requireOneOfPermissions, requirePermission };
  const repo = {
    archive: vi.fn().mockResolvedValue({ id: "x", status: "archived" }),
    create: vi.fn().mockResolvedValue({ id: "x", status: "draft" }),
    detail: vi.fn().mockResolvedValue({ audit: [], id: "x", status: "draft" }),
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0, statusCounts: {} }),
    patch: vi.fn().mockResolvedValue({ id: "x", status: "draft" }),
    publish: vi.fn().mockResolvedValue({ id: "x", status: "published" }),
    remove: vi.fn().mockResolvedValue({ deleted: true, id: "x" })
  };
  return {
    auth,
    controller: new CompetenciesAdminController(auth as never, repo as never),
    repo
  };
}

const targetId = "33333333-3333-4333-8333-333333333333";
const validCreate = {
  code: "BJT.N3.LISTENING",
  descriptionVi: "Năng lực nghe BJT-N3",
  level: "BJT-J3",
  reason: "seed N3 framework",
  titleJa: null,
  titleVi: "Nghe BJT-N3"
};
const validReason = { reason: "seed N3 framework" };

describe("CompetenciesAdminController RBAC", () => {
  it("denies list without read perms", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: false });
    await expect(controller.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.list).not.toHaveBeenCalled();
  });
  it("allows list for viewer.audit", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await controller.list({} as never, { level: "BJT-J3" });
    expect(repo.list).toHaveBeenCalled();
  });
  it("denies create without write perms", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(controller.create({} as never, validCreate)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("allows create with write and validates code regex", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await controller.create({} as never, validCreate);
    expect(repo.create).toHaveBeenCalled();
  });
  it("rejects create with invalid code (lowercase)", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await expect(
      controller.create({} as never, { ...validCreate, code: "lowercase.bad" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("denies publish without write", async () => {
    const { controller } = createController({ canManage: false, canRead: true });
    await expect(controller.publish({} as never, targetId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
  it("denies archive without write", async () => {
    const { controller } = createController({ canManage: false, canRead: true });
    await expect(controller.archive({} as never, targetId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
  it("denies delete without write", async () => {
    const { controller } = createController({ canManage: false, canRead: true });
    await expect(controller.remove({} as never, targetId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});
