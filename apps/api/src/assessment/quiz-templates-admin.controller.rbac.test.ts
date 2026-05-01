import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { QuizTemplatesAdminController } from "./quiz-templates-admin.controller.js";

function ctrl(opts: { canManage: boolean; canRead: boolean }) {
  const requirePermission = vi.fn().mockImplementation(async (_r: unknown, p: string) => {
    if (p === "assessment.manage" && !opts.canManage) throw new ForbiddenException("forbidden");
    return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["assessment.manage"] };
  });
  const requireOneOfPermissions = vi.fn().mockImplementation(async () => {
    if (!opts.canRead) throw new ForbiddenException("forbidden");
    return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["assessment.review"] };
  });
  const auth = { requirePermission, requireOneOfPermissions };
  const repo = {
    list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
    detail: vi.fn().mockResolvedValue({ id: "x", status: "draft" }),
    create: vi.fn().mockResolvedValue({ id: "x", status: "draft" }),
    patch: vi.fn().mockResolvedValue({ id: "x", status: "draft" }),
    publish: vi.fn().mockResolvedValue({ id: "x", status: "published" }),
    archive: vi.fn().mockResolvedValue({ id: "x", status: "archived" }),
    duplicate: vi.fn().mockResolvedValue({ id: "x2", status: "draft" }),
    remove: vi.fn().mockResolvedValue({ deleted: true, id: "x" })
  };
  return { auth, repo, controller: new QuizTemplatesAdminController(auth as never, repo as never) };
}

const validCreate = {
  slug: "daily-n3-vocab",
  titleVi: "Daily N3 Vocab",
  titleJa: null,
  description: null,
  level: "BJT-J3" as const,
  type: "daily" as const,
  generationRules: {
    questionCount: 10,
    timeLimitSec: 600,
    difficultyMix: [
      { difficulty: "easy" as const, weight: 0.3 },
      { difficulty: "standard" as const, weight: 0.5 },
      { difficulty: "hard" as const, weight: 0.2 }
    ],
    topicMix: [{ topic: "vocab", weight: 1 }]
  },
  reason: "initial draft"
};

describe("QuizTemplatesAdminController RBAC", () => {
  it("denies list without read perms", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: false });
    await expect(controller.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.list).not.toHaveBeenCalled();
  });

  it("allows list for assessment.review", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: true });
    await controller.list({} as never, {});
    expect(repo.list).toHaveBeenCalled();
  });

  it("denies create without assessment.manage", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: true });
    await expect(controller.create({} as never, validCreate)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("allows create with assessment.manage", async () => {
    const { controller, repo } = ctrl({ canManage: true, canRead: true });
    await controller.create({} as never, validCreate);
    expect(repo.create).toHaveBeenCalled();
  });

  it("rejects invalid generationRules (questionCount=0)", async () => {
    const { controller } = ctrl({ canManage: true, canRead: true });
    await expect(
      controller.create({} as never, {
        ...validCreate,
        generationRules: { ...validCreate.generationRules, questionCount: 0 }
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
