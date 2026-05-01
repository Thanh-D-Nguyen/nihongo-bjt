import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { BattleConfigsAdminController } from "./battle-configs-admin.controller.js";

/**
 * Battle Configs admin RBAC + Zod validation boundary tests.
 *
 * The class-level `AdminRbacGuard` short-circuits requests whose principal lacks all of
 * `["battle.manage", "viewer.audit", "iam.manage"]`. The controller methods then call
 * `requirePermission("battle.manage")` for writes, or `requireOneOfPermissions(["battle.manage",
 * "viewer.audit"])` for reads. These tests exercise the controller methods directly because the
 * guard is integration-tested elsewhere.
 */
function createController(opts: {
  canManage: boolean;
  canRead: boolean;
}) {
  const requirePermission = vi.fn().mockImplementation(async (_req: unknown, perm: string) => {
    if (perm === "battle.manage" && !opts.canManage) {
      throw new ForbiddenException("forbidden");
    }
    return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["battle.manage"] };
  });
  const requireOneOfPermissions = vi.fn().mockImplementation(async () => {
    if (!opts.canRead) {
      throw new ForbiddenException("forbidden");
    }
    return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["viewer.audit"] };
  });
  const auth = { requireOneOfPermissions, requirePermission };
  const repo = {
    archive: vi.fn().mockResolvedValue({ id: "x", status: "archived" }),
    create: vi.fn().mockResolvedValue({ id: "x", status: "draft" }),
    detail: vi.fn().mockResolvedValue({ audit: [], id: "x", status: "draft" }),
    duplicate: vi.fn().mockResolvedValue({ id: "x2", status: "draft" }),
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    patch: vi.fn().mockResolvedValue({ id: "x", status: "draft" }),
    publish: vi.fn().mockResolvedValue({ id: "x", status: "published" }),
    remove: vi.fn().mockResolvedValue({ deleted: true, id: "x" })
  };
  return {
    auth,
    controller: new BattleConfigsAdminController(auth as never, repo as never),
    repo
  };
}

const targetId = "22222222-2222-4222-8222-222222222222";
const validCreate = {
  botDifficulties: ["easy", "medium"],
  description: "BJT N3 practice",
  level: "jlpt_n3",
  maxParticipants: 2,
  name: "BJT N3 Practice",
  questionCount: 10,
  questionPoolKey: "bjt_questions_active",
  reason: "rotation T1",
  scheduleEnd: null,
  scheduleStart: null,
  scoringRules: { correctPoints: 10 },
  timePerQuestionSec: 30
};
const validReason = { reason: "rotation T1" };

describe("BattleConfigsAdminController RBAC", () => {
  describe("read endpoints (battle.manage OR viewer.audit)", () => {
    it("denies list without read perms", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: false });
      await expect(controller.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.list).not.toHaveBeenCalled();
    });

    it("allows list for viewer.audit", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: true });
      await controller.list({} as never, { status: "draft", page: "1", pageSize: "25" });
      expect(repo.list).toHaveBeenCalled();
      const arg = repo.list.mock.calls[0]?.[0];
      expect(arg?.status).toBe("draft");
      expect(arg?.page).toBe(1);
    });

    it("denies detail without read perms", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: false });
      await expect(controller.detail({} as never, targetId)).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.detail).not.toHaveBeenCalled();
    });

    it("allows detail for viewer.audit", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: true });
      await controller.detail({} as never, targetId);
      expect(repo.detail).toHaveBeenCalledWith(targetId);
    });
  });

  describe("write endpoints (battle.manage required)", () => {
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
        expect.objectContaining({ name: "BJT N3 Practice", reason: "rotation T1" })
      );
    });

    it("rejects create with invalid Zod body (questionCount out of range)", async () => {
      const { controller, repo } = createController({ canManage: true, canRead: true });
      await expect(
        controller.create({} as never, { ...validCreate, questionCount: 100 })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("denies patch without battle.manage", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: true });
      await expect(
        controller.patch({} as never, targetId, { name: "x", reason: "rotate" })
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.patch).not.toHaveBeenCalled();
    });

    it("denies publish without battle.manage", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: true });
      await expect(controller.publish({} as never, targetId, validReason)).rejects.toBeInstanceOf(
        ForbiddenException
      );
      expect(repo.publish).not.toHaveBeenCalled();
    });

    it("allows publish with battle.manage", async () => {
      const { controller, repo } = createController({ canManage: true, canRead: true });
      await controller.publish({} as never, targetId, validReason);
      expect(repo.publish).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        targetId,
        "rotation T1"
      );
    });

    it("denies archive without battle.manage", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: true });
      await expect(controller.archive({} as never, targetId, validReason)).rejects.toBeInstanceOf(
        ForbiddenException
      );
      expect(repo.archive).not.toHaveBeenCalled();
    });

    it("denies duplicate without battle.manage", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: true });
      await expect(controller.duplicate({} as never, targetId, validReason)).rejects.toBeInstanceOf(
        ForbiddenException
      );
      expect(repo.duplicate).not.toHaveBeenCalled();
    });

    it("denies remove without battle.manage", async () => {
      const { controller, repo } = createController({ canManage: false, canRead: true });
      await expect(controller.remove({} as never, targetId, validReason)).rejects.toBeInstanceOf(
        ForbiddenException
      );
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it("rejects publish with too-short reason (Zod)", async () => {
      const { controller, repo } = createController({ canManage: true, canRead: true });
      await expect(
        controller.publish({} as never, targetId, { reason: "x" })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.publish).not.toHaveBeenCalled();
    });
  });
});
