import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { DailyItemsAdminController } from "./daily-items-admin.controller.js";

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
    archive: vi.fn().mockResolvedValue({ id: "x" }),
    create: vi.fn().mockResolvedValue({ id: "x" }),
    detail: vi.fn().mockResolvedValue({ id: "x", audit: [], engagement: {} }),
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0, statusCounts: {} }),
    patch: vi.fn().mockResolvedValue({ id: "x" }),
    publish: vi.fn().mockResolvedValue({ id: "x" }),
    remove: vi.fn().mockResolvedValue({ deleted: true, id: "x" }),
    schedule: vi.fn().mockResolvedValue({ id: "x" })
  };
  return {
    auth,
    controller: new DailyItemsAdminController(auth as never, repo as never),
    repo
  };
}

const targetId = "55555555-5555-4555-8555-555555555555";
const validCreate = {
  bodyMd: null,
  contentDate: "2026-05-15",
  explanationText: null,
  japaneseText: "今日は",
  locale: "vi",
  readingText: "kyou wa",
  reason: "schedule daily phrase",
  sourceProvider: null,
  sourceRef: null,
  title: "Greeting of the day",
  widgetKind: "time_greeting"
};
const validReason = { reason: "schedule daily phrase" };

describe("DailyItemsAdminController RBAC", () => {
  it("denies list without read perms", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: false });
    await expect(controller.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.list).not.toHaveBeenCalled();
  });
  it("allows list for viewer.audit with date filters", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await controller.list({} as never, { from: "2026-05-01", to: "2026-05-31" });
    expect(repo.list).toHaveBeenCalled();
    expect(repo.list.mock.calls[0]?.[0].from).toBe("2026-05-01");
  });
  it("denies create without write", async () => {
    const { controller, repo } = createController({ canManage: false, canRead: true });
    await expect(controller.create({} as never, validCreate)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("allows create with write and validates Zod date", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await controller.create({} as never, validCreate);
    expect(repo.create).toHaveBeenCalled();
  });
  it("rejects create with bad date format", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await expect(
      controller.create({} as never, { ...validCreate, contentDate: "2026/05/15" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("denies schedule/publish/archive/delete without write", async () => {
    const { controller } = createController({ canManage: false, canRead: true });
    await expect(controller.schedule({} as never, targetId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(controller.publish({} as never, targetId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(controller.archive({} as never, targetId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(controller.remove({} as never, targetId, validReason)).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
  it("allows schedule with write", async () => {
    const { controller, repo } = createController({ canManage: true, canRead: true });
    await controller.schedule({} as never, targetId, validReason);
    expect(repo.schedule).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      targetId,
      "schedule daily phrase"
    );
  });
});
