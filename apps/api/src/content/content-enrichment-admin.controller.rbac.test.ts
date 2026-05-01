import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { ContentEnrichmentAdminController } from "./content-enrichment-admin.controller.js";

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
    bulkRetry: vi.fn().mockResolvedValue({ results: [], retried: 0, total: 0 }),
    cancel: vi.fn().mockResolvedValue({ id: "x" }),
    detail: vi.fn().mockResolvedValue({ id: "x" }),
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, statusCounts: {}, total: 0 }),
    retry: vi.fn().mockResolvedValue({ id: "x" })
  };
  return {
    auth,
    controller: new ContentEnrichmentAdminController(auth as never, repo as never),
    repo
  };
}

const targetId = "22222222-2222-4222-8222-222222222222";
const validReason = { reason: "rerun after provider fix" };

describe("ContentEnrichmentAdminController RBAC", () => {
  it("denies list without read perms", async () => {
    const { controller, repo } = createController({ canRead: false, canWrite: false });
    await expect(controller.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.list).not.toHaveBeenCalled();
  });
  it("allows list for viewer.audit", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: false });
    await controller.list({} as never, { status: "failed", type: "furigana" });
    expect(repo.list).toHaveBeenCalled();
  });
  it("rejects list with invalid status", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: false });
    await expect(
      controller.list({} as never, { status: "weird-state" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.list).not.toHaveBeenCalled();
  });
  it("denies retry without admin.content.write", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: false });
    await expect(controller.retry({} as never, targetId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(repo.retry).not.toHaveBeenCalled();
  });
  it("allows retry with admin.content.write", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: true });
    await controller.retry({} as never, targetId, validReason);
    expect(repo.retry).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      targetId,
      validReason.reason
    );
  });
  it("denies cancel without admin.content.write", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: false });
    await expect(controller.cancel({} as never, targetId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(repo.cancel).not.toHaveBeenCalled();
  });
  it("rejects retry with too-short reason", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: true });
    await expect(controller.retry({} as never, targetId, { reason: "x" })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(repo.retry).not.toHaveBeenCalled();
  });
  it("denies bulk-retry without admin.content.write", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: false });
    await expect(
      controller.bulkRetry({} as never, { jobIds: [targetId], reason: "rerun batch" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.bulkRetry).not.toHaveBeenCalled();
  });
  it("allows bulk-retry with admin.content.write", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: true });
    await controller.bulkRetry({} as never, { jobIds: [targetId], reason: "rerun batch" });
    expect(repo.bulkRetry).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      [targetId],
      "rerun batch"
    );
  });
  it("rejects bulk-retry with empty jobIds", async () => {
    const { controller, repo } = createController({ canRead: true, canWrite: true });
    await expect(
      controller.bulkRetry({} as never, { jobIds: [], reason: "rerun batch" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.bulkRetry).not.toHaveBeenCalled();
  });
});
