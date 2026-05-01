import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { QuestionBankAdminController } from "./question-bank-admin.controller.js";

function ctrl(opts: { canManage: boolean; canRead: boolean }) {
  const requirePermission = vi.fn().mockImplementation(async (_r: unknown, p: string) => {
    if (p === "assessment.manage" && !opts.canManage) throw new ForbiddenException("forbidden");
    return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["assessment.manage"] };
  });
  const requireOneOfPermissions = vi.fn().mockImplementation(async (_req: unknown, perms: string[]) => {
    // For read perms the test presumes review or audit is granted iff canRead; suggest also requires manage|review
    if (!opts.canRead && !(opts.canManage && perms.includes("assessment.manage"))) {
      throw new ForbiddenException("forbidden");
    }
    return {
      actorId: "11111111-1111-4111-8111-111111111111",
      permissions: opts.canManage ? ["assessment.manage"] : ["assessment.review"]
    };
  });
  const auth = { requirePermission, requireOneOfPermissions };
  const repo = {
    list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
    detail: vi.fn().mockResolvedValue({ id: "x", status: "draft" }),
    create: vi.fn().mockResolvedValue({ id: "x", status: "draft" }),
    patch: vi.fn().mockResolvedValue({ id: "x", status: "draft" }),
    bulk: vi.fn().mockResolvedValue({ processed: 0, totalRequested: 0, action: "publish" }),
    suggestEdit: vi.fn().mockResolvedValue({ suggested: true, id: "x", field: "prompt" }),
    remove: vi.fn().mockResolvedValue({ deleted: true, id: "x" })
  };
  return { auth, repo, controller: new QuestionBankAdminController(auth as never, repo as never) };
}

const sectionId = "33333333-3333-4333-8333-333333333333";
const validCreate = {
  sectionId,
  prompt: "What is the meaning of 食べる?",
  scenario: null,
  explanationVi: "Động từ ăn",
  skillTag: "vocab.verb",
  difficulty: "standard" as const,
  tags: ["bjt", "verb"],
  options: [
    { optionKey: "A", text: "to eat", isCorrect: true },
    { optionKey: "B", text: "to drink", isCorrect: false },
    { optionKey: "C", text: "to read", isCorrect: false },
    { optionKey: "D", text: "to write", isCorrect: false }
  ],
  reason: "initial draft"
};

const targetId = "44444444-4444-4444-8444-444444444444";

describe("QuestionBankAdminController RBAC", () => {
  it("denies list without read perms", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: false });
    await expect(controller.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.list).not.toHaveBeenCalled();
  });

  it("allows list for assessment.review and viewer.audit", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: true });
    await controller.list({} as never, { tags: "bjt,verb" });
    const arg = repo.list.mock.calls[0]?.[0];
    expect(arg?.tags).toEqual(["bjt", "verb"]);
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

  it("rejects create when no option marked correct", async () => {
    const { controller } = ctrl({ canManage: true, canRead: true });
    await expect(
      controller.create({} as never, {
        ...validCreate,
        options: validCreate.options.map((o) => ({ ...o, isCorrect: false }))
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects create when more than one option is correct", async () => {
    const { controller } = ctrl({ canManage: true, canRead: true });
    await expect(
      controller.create({} as never, {
        ...validCreate,
        options: [
          { optionKey: "A", text: "x", isCorrect: true },
          { optionKey: "B", text: "y", isCorrect: true }
        ]
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("denies bulk without assessment.manage", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: true });
    await expect(
      controller.bulk({} as never, { action: "publish", ids: [targetId], reason: "rotation" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.bulk).not.toHaveBeenCalled();
  });

  it("requires tags param when bulk action is tag/untag", async () => {
    const { controller } = ctrl({ canManage: true, canRead: true });
    await expect(
      controller.bulk({} as never, { action: "tag", ids: [targetId], reason: "rotation" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("suggest-edit allowed for assessment.review (no live mutation)", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: true });
    const result = await controller.suggestEdit({} as never, targetId, {
      field: "prompt",
      proposedValue: "Improved prompt",
      rationale: "Clearer scenario phrasing for learners",
      reason: "review pass"
    });
    expect(repo.suggestEdit).toHaveBeenCalled();
    expect(repo.patch).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
    expect(result).toEqual({ suggested: true, id: "x", field: "prompt" });
  });

  it("suggest-edit denied without any of [manage|review]", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: false });
    await expect(
      controller.suggestEdit({} as never, targetId, {
        field: "prompt",
        proposedValue: "x",
        rationale: "Detailed rationale string",
        reason: "review pass"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.suggestEdit).not.toHaveBeenCalled();
  });

  it("denies remove without assessment.manage", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: true });
    await expect(
      controller.remove({} as never, targetId, { reason: "cleanup" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.remove).not.toHaveBeenCalled();
  });
});
