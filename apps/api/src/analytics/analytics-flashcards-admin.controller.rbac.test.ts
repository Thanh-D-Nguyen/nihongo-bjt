import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { AnalyticsFlashcardsAdminController } from "./analytics-flashcards-admin.controller.js";

function build(opts: { canRead: boolean; canExport: boolean }) {
  const requireOneOfPermissions = vi
    .fn()
    .mockImplementation(async (_req: unknown, candidates: readonly string[]) => {
      const isExport = candidates.some((c) => c === "analytics.export" || c === "analytics.manage");
      if (isExport && !opts.canExport) throw new ForbiddenException("forbidden");
      if (!isExport && !opts.canRead) throw new ForbiddenException("forbidden");
      return { actorId: "33333333-3333-4333-8333-333333333333", permissions: new Set<string>() };
    });
  const repo = {
    breakdown: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    summary: vi.fn().mockResolvedValue({ kpis: [], range: { days: 30 } }),
    timeseries: vi.fn().mockResolvedValue({ series: [] })
  };
  const res = { send: vi.fn(), setHeader: vi.fn() };
  return {
    controller: new AnalyticsFlashcardsAdminController({ requireOneOfPermissions } as never, repo as never),
    repo,
    res
  };
}

describe("AnalyticsFlashcardsAdminController RBAC", () => {
  it("denies breakdown without read perm", async () => {
    const { controller } = build({ canExport: false, canRead: false });
    await expect(controller.breakdown({} as never, { range: "30d" })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("allows timeseries with read perm", async () => {
    const { controller, repo } = build({ canExport: false, canRead: true });
    await controller.timeseries({} as never, { metric: "reviews", range: "7d" });
    expect(repo.timeseries).toHaveBeenCalled();
  });
  it("denies export without export perm", async () => {
    const { controller } = build({ canExport: false, canRead: true });
    await expect(
      controller.export({} as never, { send: vi.fn(), setHeader: vi.fn() } as never, { range: "30d" }, { reason: "monthly" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("allows export with export perm", async () => {
    const { controller, res } = build({ canExport: true, canRead: true });
    await controller.export({} as never, res as never, { range: "30d", view: "timeseries", metric: "reviews" }, { reason: "monthly" });
    expect(res.send).toHaveBeenCalled();
  });
  it("rejects refresh with too-short reason", async () => {
    const { controller } = build({ canExport: true, canRead: true });
    await expect(controller.refresh({} as never, { reason: "x" })).rejects.toBeInstanceOf(BadRequestException);
  });
});
