import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { ContentVersionsAdminController } from "./content-versions-admin.controller.js";

function createController(opts: { canWrite: boolean; canRead: boolean }) {
  const requirePermission = vi.fn().mockImplementation(async (_req: unknown, perm: string) => {
    if (perm === "admin.content.write" && !opts.canWrite) {
      throw new ForbiddenException("forbidden");
    }
    return {
      actorId: "11111111-1111-4111-8111-111111111111",
      permissions: ["admin.content.write"]
    };
  });
  const requireOneOfPermissions = vi.fn().mockImplementation(async () => {
    if (!opts.canRead) throw new ForbiddenException("forbidden");
    return {
      actorId: "11111111-1111-4111-8111-111111111111",
      permissions: ["viewer.audit"]
    };
  });
  const auth = { requireOneOfPermissions, requirePermission };
  const repo = {
    detail: vi.fn().mockResolvedValue({ id: "x" }),
    diff: vi.fn().mockResolvedValue({ diff: { json: [], text: { from: "", lines: [], to: "" } } }),
    historyForEntity: vi.fn().mockResolvedValue({ items: [] }),
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, statusCounts: {}, total: 0 }),
    revert: vi.fn().mockResolvedValue({ id: "newId", status: "published" })
  };
  return {
    auth,
    controller: new ContentVersionsAdminController(auth as never, repo as never),
    repo
  };
}

const fromId = "11111111-1111-4111-8111-aaaaaaaaaaaa";
const toId = "22222222-2222-4222-8222-bbbbbbbbbbbb";
const validReason = { reason: "rolling back regression" };

describe("ContentVersionsAdminController RBAC", () => {
  it("denies list without read perms", async () => {
    const { controller, repo } = createController({ canRead: false, canWrite: false });
    await expect(controller.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.list).not.toHaveBeenCalled();
  });
  it("allows list for viewer.audit", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: false });
    await controller.list({} as never, { status: "draft" });
    expect(repo.list).toHaveBeenCalled();
  });
  it("allows diff for viewer.audit", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: false });
    await controller.diff({} as never, { from: fromId, to: toId });
    expect(repo.diff).toHaveBeenCalledWith(fromId, toId);
  });
  it("rejects diff with non-uuid params", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: false });
    await expect(
      controller.diff({} as never, { from: "x", to: "y" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.diff).not.toHaveBeenCalled();
  });
  it("rejects entity history without entityType", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: false });
    await expect(
      controller.historyForEntity({} as never, fromId, undefined)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.historyForEntity).not.toHaveBeenCalled();
  });
  it("denies revert without admin.content.write", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: false });
    await expect(controller.revert({} as never, fromId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(repo.revert).not.toHaveBeenCalled();
  });
  it("allows revert with admin.content.write", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: true });
    await controller.revert({} as never, fromId, validReason);
    expect(repo.revert).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      fromId,
      validReason.reason
    );
  });
  it("rejects revert with too-short reason", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: true });
    await expect(controller.revert({} as never, fromId, { reason: "x" })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(repo.revert).not.toHaveBeenCalled();
  });
});
