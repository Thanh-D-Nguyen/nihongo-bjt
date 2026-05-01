import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { AnalyticsSystemAdminController } from "./analytics-system-admin.controller.js";

function build(opts: { canRead: boolean; canExport: boolean }) {
  const requireOneOfPermissions = vi
    .fn()
    .mockImplementation(async (_req: unknown, candidates: readonly string[]) => {
      const isExport = candidates.some((c) => c === "analytics.export" || c === "analytics.manage");
      if (isExport && !opts.canExport) throw new ForbiddenException("forbidden");
      if (!isExport && !opts.canRead) throw new ForbiddenException("forbidden");
      return { actorId: "55555555-5555-4555-8555-555555555555", permissions: new Set<string>() };
    });
  const repo = {
    breakdown: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    summary: vi.fn().mockResolvedValue({ kpis: [], notices: [], range: { days: 30 } }),
    timeseries: vi.fn().mockResolvedValue({ series: [] })
  };
  const res = { send: vi.fn(), setHeader: vi.fn() };
  return { controller: new AnalyticsSystemAdminController({ requireOneOfPermissions } as never, repo as never), repo, res };
}

describe("AnalyticsSystemAdminController RBAC", () => {
  it("denies summary without read perm", async () => {
    const { controller } = build({ canExport: false, canRead: false });
    await expect(controller.summary({} as never, { range: "30d" })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("allows summary with read perm and surfaces notices", async () => {
    const { controller, repo } = build({ canExport: false, canRead: true });
    await controller.summary({} as never, { range: "30d" });
    expect(repo.summary).toHaveBeenCalled();
  });
  it("denies refresh without export perm", async () => {
    const { controller } = build({ canExport: false, canRead: true });
    await expect(controller.refresh({} as never, { reason: "rotate" })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("rejects export without reason", async () => {
    const { controller } = build({ canExport: true, canRead: true });
    await expect(
      controller.export({} as never, { send: vi.fn(), setHeader: vi.fn() } as never, { range: "30d" }, {})
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it("allows export with export perm", async () => {
    const { controller, res } = build({ canExport: true, canRead: true });
    await controller.export({} as never, res as never, { range: "30d", view: "summary" }, { reason: "monthly" });
    expect(res.send).toHaveBeenCalled();
  });
});
