import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { QuizSessionsAdminController } from "./quiz-sessions-admin.controller.js";

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
    list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
    detail: vi.fn().mockResolvedValue({ id: "x", status: "in_progress" }),
    abort: vi.fn().mockResolvedValue({ id: "x", status: "abandoned" }),
    extendTime: vi.fn().mockResolvedValue({ id: "x", status: "in_progress" })
  };
  return { auth, repo, controller: new QuizSessionsAdminController(auth as never, repo as never) };
}

const id = "55555555-5555-4555-8555-555555555555";

describe("QuizSessionsAdminController RBAC", () => {
  it("denies list without read perms", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: false });
    await expect(controller.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.list).not.toHaveBeenCalled();
  });

  it("allows list for viewer.audit and assessment.review", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: true });
    await controller.list({} as never, { status: "in_progress" });
    expect(repo.list).toHaveBeenCalled();
  });

  it("denies abort without assessment.manage", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: true });
    await expect(
      controller.abort({} as never, id, { reason: "abuse" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.abort).not.toHaveBeenCalled();
  });

  it("allows abort with assessment.manage and reason", async () => {
    const { controller, repo } = ctrl({ canManage: true, canRead: true });
    await controller.abort({} as never, id, { reason: "abuse pattern" });
    expect(repo.abort).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      id,
      "abuse pattern"
    );
  });

  it("rejects abort without reason", async () => {
    const { controller } = ctrl({ canManage: true, canRead: true });
    await expect(controller.abort({} as never, id, { reason: "" })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("denies extend-time without assessment.manage", async () => {
    const { controller, repo } = ctrl({ canManage: false, canRead: true });
    await expect(
      controller.extendTime({} as never, id, { addSeconds: 60, reason: "support request" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.extendTime).not.toHaveBeenCalled();
  });

  it("rejects extend-time when addSeconds is below minimum", async () => {
    const { controller } = ctrl({ canManage: true, canRead: true });
    await expect(
      controller.extendTime({} as never, id, { addSeconds: 5, reason: "support" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows extend-time with valid body", async () => {
    const { controller, repo } = ctrl({ canManage: true, canRead: true });
    await controller.extendTime({} as never, id, { addSeconds: 120, reason: "support request" });
    expect(repo.extendTime).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      id,
      120,
      "support request"
    );
  });
});
