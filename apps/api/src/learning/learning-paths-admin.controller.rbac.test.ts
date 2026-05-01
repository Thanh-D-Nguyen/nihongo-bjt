import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { LearningPathsAdminController } from "./learning-paths-admin.controller.js";

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
    duplicate: vi.fn().mockResolvedValue({ id: "x2", status: "draft" }),
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0, statusCounts: {} }),
    patch: vi.fn().mockResolvedValue({ id: "x", status: "draft" }),
    publish: vi.fn().mockResolvedValue({ id: "x", status: "published" }),
    remove: vi.fn().mockResolvedValue({ deleted: true, id: "x" })
  };
  return {
    auth,
    controller: new LearningPathsAdminController(auth as never, repo as never),
    repo
  };
}

const targetId = "22222222-2222-4222-8222-222222222222";
const validCreate = {
  descriptionJa: null,
  descriptionVi: "Lộ trình BJT N3",
  displayOrder: 0,
  reason: "ship slice T1",
  slug: "bjt-n3-fast-track",
  targetLevel: "BJT-J3",
  titleJa: null,
  titleVi: "BJT-N3 Fast Track"
};
const validReason = { reason: "ship slice T1" };

describe("LearningPathsAdminController RBAC", () => {
  describe("reads", () => {
    it("denies list without read perms", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: false });
      await expect(controller.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.list).not.toHaveBeenCalled();
    });
    it("allows list for viewer.audit", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: true });
      await controller.list({} as never, { status: "draft" });
      expect(repo.list).toHaveBeenCalled();
      expect(repo.list.mock.calls[0]?.[0].status).toBe("draft");
    });
    it("denies detail without read perms", async () => {
      const { controller } = createController({ canManage: false, canRead: false });
      await expect(controller.detail({} as never, targetId)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("writes", () => {
    it("denies create without admin.content.write", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: true });
      await expect(controller.create({} as never, validCreate)).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.create).not.toHaveBeenCalled();
    });
    it("allows create with admin.content.write and validates Zod", async () => {
      const { controller, repo } = createController({ canManage: true, canRead: true });
      await controller.create({} as never, validCreate);
      expect(repo.create).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        expect.objectContaining({ slug: "bjt-n3-fast-track", reason: "ship slice T1" })
      );
    });
    it("rejects create with invalid slug", async () => {
      const { controller, repo } = createController({ canManage: true, canRead: true });
      await expect(
        controller.create({} as never, { ...validCreate, slug: "Invalid Slug!" })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });
    it("denies patch without admin.content.write", async () => {
      const { controller } = createController({ canManage: false, canRead: true });
      await expect(
        controller.patch({} as never, targetId, { titleVi: "x", reason: "ship slice T1" })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
    it("denies publish without admin.content.write", async () => {
      const { controller } = createController({ canManage: false, canRead: true });
      await expect(controller.publish({} as never, targetId, validReason)).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });
    it("allows publish with admin.content.write", async () => {
      const { controller, repo } = createController({ canManage: true, canRead: true });
      await controller.publish({} as never, targetId, validReason);
      expect(repo.publish).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        targetId,
        "ship slice T1"
      );
    });
    it("denies archive without admin.content.write", async () => {
      const { controller } = createController({ canManage: false, canRead: true });
      await expect(controller.archive({} as never, targetId, validReason)).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });
    it("denies duplicate without admin.content.write", async () => {
      const { controller } = createController({ canManage: false, canRead: true });
      await expect(controller.duplicate({} as never, targetId, validReason)).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });
    it("denies delete without admin.content.write", async () => {
      const { controller } = createController({ canManage: false, canRead: true });
      await expect(controller.remove({} as never, targetId, validReason)).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });
    it("rejects publish with too-short reason", async () => {
      const { controller } = createController({ canManage: true, canRead: true });
      await expect(
        controller.publish({} as never, targetId, { reason: "x" })
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
