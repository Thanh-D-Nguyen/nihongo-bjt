import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { GrowthCampaignsAdminController } from "./growth-campaigns-admin.controller.js";

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
    create: vi.fn().mockResolvedValue({ id: "x", status: "draft" }),
    detail: vi.fn().mockResolvedValue({ audit: [], id: "x", status: "draft" }),
    duplicate: vi.fn().mockResolvedValue({ id: "x2", status: "draft" }),
    estimateAudienceSize: vi.fn().mockResolvedValue({ filters: {}, total: 0 }),
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    patch: vi.fn().mockResolvedValue({ id: "x", status: "draft" }),
    transition: vi.fn().mockResolvedValue({ id: "x", status: "active" })
  };
  return {
    auth,
    controller: new GrowthCampaignsAdminController(auth as never, repo as never),
    repo
  };
}

const targetId = "22222222-2222-4222-8222-222222222222";
const validCreate = {
  channel: "email",
  contentBody: "Hello",
  description: "test",
  name: "Spring growth push",
  reason: "T1 launch",
  scheduleEnd: null,
  scheduleStart: null
};
const validReason = { reason: "rotate" };

describe("GrowthCampaignsAdminController RBAC", () => {
  describe("read endpoints (growth.manage | admin.growth.read | viewer.audit)", () => {
    it("denies list without read perms", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: false });
      await expect(controller.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.list).not.toHaveBeenCalled();
    });
    it("allows list for viewer.audit", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: true });
      await controller.list({} as never, { status: "draft", page: "1", pageSize: "25" });
      expect(repo.list).toHaveBeenCalled();
    });
    it("denies detail without read perms", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: false });
      await expect(controller.detail({} as never, targetId)).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.detail).not.toHaveBeenCalled();
    });
  });

  describe("write endpoints (growth.manage required)", () => {
    it("denies create without growth.manage", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: true });
      await expect(controller.create({} as never, validCreate)).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.create).not.toHaveBeenCalled();
    });
    it("allows create with growth.manage and validates Zod", async () => {
      const { controller, repo } = createController({ canManage: true, canRead: true });
      await controller.create({} as never, validCreate);
      expect(repo.create).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        expect.objectContaining({ name: "Spring growth push", reason: "T1 launch" })
      );
    });
    it("rejects create with invalid Zod body (bad channel)", async () => {
      const { controller, repo } = createController({ canManage: true, canRead: true });
      await expect(
        controller.create({} as never, { ...validCreate, channel: "fax" })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });
    it("denies patch without growth.manage", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: true });
      await expect(
        controller.patch({} as never, targetId, { name: "x", reason: "rotate" })
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.patch).not.toHaveBeenCalled();
    });
    it("denies schedule without growth.manage", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: true });
      await expect(controller.schedule({} as never, targetId, validReason)).rejects.toBeInstanceOf(
        ForbiddenException
      );
      expect(repo.transition).not.toHaveBeenCalled();
    });
    it("denies activate without growth.manage", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: true });
      await expect(controller.activate({} as never, targetId, validReason)).rejects.toBeInstanceOf(
        ForbiddenException
      );
      expect(repo.transition).not.toHaveBeenCalled();
    });
    it("denies end without growth.manage", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: true });
      await expect(controller.end({} as never, targetId, validReason)).rejects.toBeInstanceOf(
        ForbiddenException
      );
      expect(repo.transition).not.toHaveBeenCalled();
    });
    it("denies archive without growth.manage", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: true });
      await expect(controller.archive({} as never, targetId, validReason)).rejects.toBeInstanceOf(
        ForbiddenException
      );
      expect(repo.transition).not.toHaveBeenCalled();
    });
    it("denies duplicate without growth.manage", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: true });
      await expect(controller.duplicate({} as never, targetId, validReason)).rejects.toBeInstanceOf(
        ForbiddenException
      );
      expect(repo.duplicate).not.toHaveBeenCalled();
    });
    it("rejects activate with too-short reason (Zod)", async () => {
      const { controller, repo } = createController({ canManage: true, canRead: true });
      await expect(
        controller.activate({} as never, targetId, { reason: "x" })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.transition).not.toHaveBeenCalled();
    });
    it("calls repo.transition with `active` for activate", async () => {
      const { controller, repo } = createController({ canManage: true, canRead: true });
      await controller.activate({} as never, targetId, validReason);
      expect(repo.transition).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        targetId,
        "active",
        "rotate"
      );
    });
  });
});
