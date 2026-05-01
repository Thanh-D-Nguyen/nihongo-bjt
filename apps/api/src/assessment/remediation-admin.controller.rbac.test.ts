import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { RemediationAdminController } from "./remediation-admin.controller.js";

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
    listRules: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
    ruleDetail: vi.fn().mockResolvedValue({ id: "x", active: true }),
    createRule: vi.fn().mockResolvedValue({ id: "x", active: true }),
    patchRule: vi.fn().mockResolvedValue({ id: "x", active: true }),
    toggleRule: vi.fn().mockResolvedValue({ id: "x", active: false }),
    removeRule: vi.fn().mockResolvedValue({ deleted: true, id: "x" }),
    listTriggers: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 })
  };
  return { auth, repo, controller: new RemediationAdminController(auth as never, repo as never) };
}

const ruleId = "66666666-6666-4666-8666-666666666666";
const recommendedContentId = "77777777-7777-4777-8777-777777777777";
const validCreate = {
  name: "N3 Vocab Review",
  description: "Recommend lesson when learner fails 3+ vocab questions in a 10-question window",
  topicSkillTag: "vocab.verb",
  level: "BJT-J3" as const,
  thresholdFailedCount: 3,
  thresholdWindowQuestions: 10,
  recommendedContentType: "lesson" as const,
  recommendedContentId,
  reason: "initial rule"
};

describe("RemediationAdminController RBAC", () => {
  it("denies listRules without read perms", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: false });
    await expect(controller.listRules({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.listRules).not.toHaveBeenCalled();
  });

  it("allows listRules for assessment.review and viewer.audit", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: true });
    await controller.listRules({} as never, { active: "true" });
    const arg = repo.listRules.mock.calls[0]?.[0];
    expect(arg?.active).toBe(true);
  });

  it("denies createRule without assessment.manage", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: true });
    await expect(controller.createRule({} as never, validCreate)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(repo.createRule).not.toHaveBeenCalled();
  });

  it("allows createRule with assessment.manage", async () => {
    const { controller, repo } = ctrl({ canManage: true, canRead: true });
    await controller.createRule({} as never, validCreate);
    expect(repo.createRule).toHaveBeenCalled();
  });

  it("rejects createRule when failedCount > windowQuestions", async () => {
    const { controller } = ctrl({ canManage: true, canRead: true });
    await expect(
      controller.createRule({} as never, { ...validCreate, thresholdFailedCount: 12, thresholdWindowQuestions: 10 })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("denies enable/disable/remove without assessment.manage", async () => {
    const { controller } = ctrl({ canManage: false, canRead: true });
    const body = { reason: "rotate" };
    await expect(controller.enableRule({} as never, ruleId, body)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(controller.disableRule({} as never, ruleId, body)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(controller.removeRule({} as never, ruleId, body)).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("allows triggers list for viewer.audit and assessment.review", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: true });
    await controller.listTriggers({} as never, { ruleId });
    expect(repo.listTriggers).toHaveBeenCalled();
  });

  it("denies triggers list without read perms", async () => {
    const { controller } = ctrl({ canManage: false, canRead: false });
    await expect(controller.listTriggers({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
  });
});
