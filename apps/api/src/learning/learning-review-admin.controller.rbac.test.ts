import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { LearningReviewAdminController } from "./learning-review-admin.controller.js";

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
    detail: vi.fn().mockResolvedValue({ id: "x", audit: [] }),
    forceReintroduce: vi.fn().mockResolvedValue({ id: "x", state: "relearning" }),
    problemCards: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 }),
    retentionCurve: vi.fn().mockResolvedValue([]),
    summary: vi.fn().mockResolvedValue({ totalCards: 0, dueNow: 0 })
  };
  return {
    auth,
    controller: new LearningReviewAdminController(auth as never, repo as never),
    repo
  };
}

const targetId = "44444444-4444-4444-8444-444444444444";

describe("LearningReviewAdminController RBAC", () => {
  it("denies summary without read perms", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: false });
    await expect(controller.summary({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.summary).not.toHaveBeenCalled();
  });
  it("allows summary for viewer.audit", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await controller.summary({} as never, { windowDays: "14" });
    expect(repo.summary).toHaveBeenCalled();
    expect(repo.summary.mock.calls[0]?.[0].windowDays).toBe(14);
  });
  it("allows retention curve for viewer.audit", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await controller.retentionCurve({} as never, {});
    expect(repo.retentionCurve).toHaveBeenCalled();
  });
  it("allows problem-cards for viewer.audit", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await controller.problemCards({} as never, { minLapses: "3" });
    expect(repo.problemCards).toHaveBeenCalled();
    expect(repo.problemCards.mock.calls[0]?.[0].minLapses).toBe(3);
  });
  it("denies force-reintroduce without write", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(
      controller.forceReintroduce({} as never, targetId, { reason: "leech recovery" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.forceReintroduce).not.toHaveBeenCalled();
  });
  it("allows force-reintroduce with write and audits reason", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await controller.forceReintroduce({} as never, targetId, { reason: "leech recovery" });
    expect(repo.forceReintroduce).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      targetId,
      "leech recovery"
    );
  });
  it("rejects force-reintroduce with too-short reason", async () => {
    const { controller } = createController({ canManage: true, canRead: true });
    await expect(
      controller.forceReintroduce({} as never, targetId, { reason: "x" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
