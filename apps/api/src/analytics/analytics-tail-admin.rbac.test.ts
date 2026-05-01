import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { AnalyticsContentAdminController } from "./analytics-content-admin.controller.js";
import { AnalyticsLearningAdminController } from "./analytics-learning-admin.controller.js";
import { AnalyticsSearchAdminController } from "./analytics-search-admin.controller.js";

function buildAuth(opts: { canRead: boolean; canExport: boolean }) {
  return vi.fn().mockImplementation(async (_req: unknown, candidates: readonly string[]) => {
    const isExport = candidates.some((c) => c === "analytics.export" || c === "analytics.manage");
    if (isExport && !opts.canExport) throw new ForbiddenException("forbidden");
    if (!isExport && !opts.canRead) throw new ForbiddenException("forbidden");
    return { actorId: "55555555-5555-4555-8555-555555555555", permissions: new Set<string>() };
  });
}

function repoStub() {
  return {
    breakdown: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    summary: vi.fn().mockResolvedValue({ kpis: [], notices: [], range: { days: 30 } }),
    timeseries: vi.fn().mockResolvedValue({ series: [] })
  };
}

function res() {
  return { send: vi.fn(), setHeader: vi.fn() };
}

describe.each([
  ["AnalyticsLearningAdminController", AnalyticsLearningAdminController, "top_studiers", "reviews"],
  ["AnalyticsContentAdminController", AnalyticsContentAdminController, "top_engaged", "card_links_created"],
  ["AnalyticsSearchAdminController", AnalyticsSearchAdminController, "top_queries", "queries"]
])("%s RBAC", (_name, Ctor, _defaultDim, _defaultMetric) => {
  it("denies summary without read perm", async () => {
    const ctrl = new (Ctor as any)({ requireOneOfPermissions: buildAuth({ canExport: false, canRead: false }) }, repoStub());
    await expect(ctrl.summary({} as never, { range: "30d" })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows summary with read perm", async () => {
    const repo = repoStub();
    const ctrl = new (Ctor as any)(
      { requireOneOfPermissions: buildAuth({ canExport: false, canRead: true }) },
      repo
    );
    await ctrl.summary({} as never, { range: "30d" });
    expect(repo.summary).toHaveBeenCalled();
  });

  it("denies refresh without export perm", async () => {
    const ctrl = new (Ctor as any)({ requireOneOfPermissions: buildAuth({ canExport: false, canRead: true }) }, repoStub());
    await expect(ctrl.refresh({} as never, { reason: "rotate" })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects export without reason", async () => {
    const ctrl = new (Ctor as any)({ requireOneOfPermissions: buildAuth({ canExport: true, canRead: true }) }, repoStub());
    await expect(
      ctrl.export({} as never, res() as never, { range: "30d" }, {})
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows export with export perm", async () => {
    const r = res();
    const ctrl = new (Ctor as any)({ requireOneOfPermissions: buildAuth({ canExport: true, canRead: true }) }, repoStub());
    await ctrl.export({} as never, r as never, { range: "30d", view: "summary" }, { reason: "monthly" });
    expect(r.send).toHaveBeenCalled();
  });
});
