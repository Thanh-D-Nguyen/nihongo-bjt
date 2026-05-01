import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { AnalyticsGrowthAdminController } from "./analytics-growth-admin.controller.js";

function build(opts: { canRead: boolean; canExport: boolean }) {
  const requireOneOfPermissions = vi
    .fn()
    .mockImplementation(async (_req: unknown, candidates: readonly string[]) => {
      const isExport = candidates.some((c) => c === "analytics.export" || c === "analytics.manage");
      if (isExport && !opts.canExport) throw new ForbiddenException("forbidden");
      if (!isExport && !opts.canRead) throw new ForbiddenException("forbidden");
      return { actorId: "44444444-4444-4444-8444-444444444444", permissions: new Set<string>() };
    });
  const repo = {
    breakdown: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    summary: vi.fn().mockResolvedValue({ kpis: [], range: { days: 30 } }),
    timeseries: vi.fn().mockResolvedValue({ series: [] })
  };
  const res = { send: vi.fn(), setHeader: vi.fn() };
  return { controller: new AnalyticsGrowthAdminController({ requireOneOfPermissions } as never, repo as never), repo, res };
}

describe("AnalyticsGrowthAdminController RBAC", () => {
  it("denies summary without read perm", async () => {
    const { controller } = build({ canExport: false, canRead: false });
    await expect(controller.summary({} as never, { range: "30d" })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("allows breakdown with read perm", async () => {
    const { controller, repo } = build({ canExport: false, canRead: true });
    await controller.breakdown({} as never, { range: "30d", dimension: "by_campaign" });
    expect(repo.breakdown).toHaveBeenCalled();
  });
  it("rejects timeseries missing metric", async () => {
    const { controller } = build({ canExport: false, canRead: true });
    await expect(controller.timeseries({} as never, { range: "30d" })).rejects.toBeInstanceOf(BadRequestException);
  });
  it("denies export without export perm", async () => {
    const { controller } = build({ canExport: false, canRead: true });
    await expect(
      controller.export({} as never, { send: vi.fn(), setHeader: vi.fn() } as never, { range: "30d" }, { reason: "monthly" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("allows export with export perm", async () => {
    const { controller, res } = build({ canExport: true, canRead: true });
    await controller.export({} as never, res as never, { range: "30d", view: "breakdown" }, { reason: "monthly" });
    expect(res.send).toHaveBeenCalled();
  });
});
