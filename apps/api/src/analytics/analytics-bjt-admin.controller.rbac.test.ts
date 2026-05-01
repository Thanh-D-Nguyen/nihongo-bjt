import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { AnalyticsBjtAdminController } from "./analytics-bjt-admin.controller.js";

function build(opts: { canRead: boolean; canExport: boolean }) {
  const requireOneOfPermissions = vi
    .fn()
    .mockImplementation(async (_req: unknown, candidates: readonly string[]) => {
      const isExport = candidates.some((c) => c === "analytics.export" || c === "analytics.manage");
      if (isExport && !opts.canExport) throw new ForbiddenException("forbidden");
      if (!isExport && !opts.canRead) throw new ForbiddenException("forbidden");
      return { actorId: "22222222-2222-4222-8222-222222222222", permissions: new Set<string>() };
    });
  const repo = {
    breakdown: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    summary: vi.fn().mockResolvedValue({ kpis: [], range: { days: 30 } }),
    timeseries: vi.fn().mockResolvedValue({ series: [] })
  };
  const res = { send: vi.fn(), setHeader: vi.fn() };
  return { controller: new AnalyticsBjtAdminController({ requireOneOfPermissions } as never, repo as never), repo, res };
}

describe("AnalyticsBjtAdminController RBAC", () => {
  it("denies summary without read perm", async () => {
    const { controller } = build({ canExport: false, canRead: false });
    await expect(controller.summary({} as never, { range: "30d" })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("allows summary with read perm", async () => {
    const { controller, repo } = build({ canExport: false, canRead: true });
    await controller.summary({} as never, { range: "7d" });
    expect(repo.summary).toHaveBeenCalled();
  });
  it("denies export without export perm", async () => {
    const { controller } = build({ canExport: false, canRead: true });
    await expect(
      controller.export({} as never, { send: vi.fn(), setHeader: vi.fn() } as never, { range: "30d" }, { reason: "monthly" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("allows export with export perm", async () => {
    const { controller, res } = build({ canExport: true, canRead: true });
    await controller.export({} as never, res as never, { range: "30d", view: "summary" }, { reason: "monthly" });
    expect(res.send).toHaveBeenCalled();
  });
  it("rejects refresh missing reason", async () => {
    const { controller } = build({ canExport: true, canRead: true });
    await expect(controller.refresh({} as never, {})).rejects.toBeInstanceOf(BadRequestException);
  });
});
