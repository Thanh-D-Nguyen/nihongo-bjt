import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { MockExamsAdminController } from "./mock-exams-admin.controller.js";

function ctrl(opts: { canManage: boolean; canRead: boolean }) {
  const requirePermission = vi.fn().mockImplementation(async (_r: unknown, p: string) => {
    if (p === "assessment.manage" && !opts.canManage) throw new ForbiddenException("forbidden");
    return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["assessment.manage"] };
  });
  const requireOneOfPermissions = vi.fn().mockImplementation(async () => {
    if (!opts.canRead) throw new ForbiddenException("forbidden");
    return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["viewer.audit"] };
  });
  const auth = { requirePermission, requireOneOfPermissions };
  const repo = {
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    detail: vi.fn().mockResolvedValue({ id: "x", status: "draft" }),
    create: vi.fn().mockResolvedValue({ id: "x", status: "draft" }),
    patch: vi.fn().mockResolvedValue({ id: "x", status: "draft" }),
    publish: vi.fn().mockResolvedValue({ id: "x", status: "published" }),
    archive: vi.fn().mockResolvedValue({ id: "x", status: "archived" }),
    duplicate: vi.fn().mockResolvedValue({ id: "x2", status: "draft" }),
    remove: vi.fn().mockResolvedValue({ deleted: true, id: "x" })
  };
  return { auth, repo, controller: new MockExamsAdminController(auth as never, repo as never) };
}

const validCreate = {
  slug: "bjt-n3-mock-1",
  titleVi: "BJT N3 Mock #1",
  titleJa: "BJT N3 模試 #1",
  description: "Full-length practice",
  level: "BJT-J3" as const,
  timeLimitSeconds: 60 * 90,
  blueprintMeta: {
    sections: [
      { code: "L", titleVi: "Listening", type: "listening", questionCount: 30, timeLimitSec: 60 * 30 },
      { code: "R", titleVi: "Reading", type: "reading", questionCount: 30, timeLimitSec: 60 * 60 }
    ],
    totalTimeMin: 90,
    scoringRubric: { passingScore: 600, perCorrectPoints: 10 }
  },
  reason: "initial draft"
};

describe("MockExamsAdminController RBAC", () => {
  it("denies list without read perms", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: false });
    await expect(controller.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.list).not.toHaveBeenCalled();
  });

  it("allows list for viewer.audit", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: true });
    await controller.list({} as never, { status: "draft", page: "1" });
    expect(repo.list).toHaveBeenCalled();
  });

  it("allows list for assessment.review", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: true });
    await controller.list({} as never, { status: "all" });
    expect(repo.list).toHaveBeenCalled();
  });

  it("denies create without assessment.manage", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: true });
    await expect(controller.create({} as never, validCreate)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("allows create with assessment.manage and validates Zod", async () => {
    const { controller, repo } = ctrl({ canManage: true, canRead: true });
    await controller.create({} as never, validCreate);
    expect(repo.create).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      expect.objectContaining({ slug: "bjt-n3-mock-1", level: "BJT-J3" })
    );
  });

  it("rejects create when totalTimeMin disagrees with timeLimitSeconds", async () => {
    const { controller, repo } = ctrl({ canManage: true, canRead: true });
    await expect(
      controller.create({} as never, { ...validCreate, timeLimitSeconds: 60 * 30 })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("denies publish/archive/duplicate/remove without assessment.manage", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: true });
    const id = "22222222-2222-4222-8222-222222222222";
    const body = { reason: "rotate" };
    await expect(controller.publish({} as never, id, body)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.archive({} as never, id, body)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.duplicate({} as never, id, body)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.remove({} as never, id, body)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.publish).not.toHaveBeenCalled();
  });

  it("rejects publish without reason", async () => {
    const { controller } = ctrl({ canManage: true, canRead: true });
    await expect(
      controller.publish({} as never, "22222222-2222-4222-8222-222222222222", { reason: "" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
