import { BadRequestException, ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { AnalyticsBattleAdminController } from "./analytics-battle-admin.controller.js";

function buildController(opts: { canRead: boolean; canExport: boolean }) {
  const requireOneOfPermissions = vi
    .fn()
    .mockImplementation(async (_req: unknown, candidates: readonly string[]) => {
      const isExportSet = candidates.some((c) => c === "analytics.export" || c === "analytics.manage");
      if (isExportSet && !opts.canExport) throw new ForbiddenException("forbidden");
      if (!isExportSet && !opts.canRead) throw new ForbiddenException("forbidden");
      return { actorId: "11111111-1111-4111-8111-111111111111", permissions: new Set<string>() };
    });
  const auth = { requireOneOfPermissions };
  const repo = {
    breakdown: vi.fn().mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 50 }),
    summary: vi.fn().mockResolvedValue({ kpis: [{ id: "totalMatches", value: 1, previous: 0, deltaRatio: null, format: "int", available: true }], range: { days: 30 } }),
    timeseries: vi.fn().mockResolvedValue({ series: [{ t: "2026-04-01", value: 0 }] })
  };
  const res = {
    send: vi.fn(),
    setHeader: vi.fn()
  };
  return {
    controller: new AnalyticsBattleAdminController(auth as never, repo as never),
    repo,
    res
  };
}

describe("AnalyticsBattleAdminController RBAC", () => {
  it("denies summary without read perm", async () => {
    const { controller, repo } = buildController({ canExport: false, canRead: false });
    await expect(
      controller.summary({} as never, { range: "30d" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.summary).not.toHaveBeenCalled();
  });

  it("allows summary with read perm and validates filter", async () => {
    const { controller, repo } = buildController({ canExport: false, canRead: true });
    await controller.summary({} as never, { range: "30d" });
    expect(repo.summary).toHaveBeenCalled();
  });

  it("rejects summary with invalid range", async () => {
    const { controller } = buildController({ canExport: false, canRead: true });
    await expect(
      controller.summary({} as never, { range: "bogus" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("denies timeseries without read perm", async () => {
    const { controller } = buildController({ canExport: false, canRead: false });
    await expect(
      controller.timeseries({} as never, { metric: "matches", range: "30d" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("denies breakdown without read perm", async () => {
    const { controller } = buildController({ canExport: false, canRead: false });
    await expect(
      controller.breakdown({} as never, { range: "30d" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("denies export without export perm", async () => {
    const { controller, repo } = buildController({ canExport: false, canRead: true });
    await expect(
      controller.export({} as never, { send: vi.fn(), setHeader: vi.fn() } as never, { range: "30d" }, { reason: "monthly" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.breakdown).not.toHaveBeenCalled();
  });

  it("allows export with export perm and writes CSV headers", async () => {
    const { controller, repo, res } = buildController({ canExport: true, canRead: true });
    await controller.export({} as never, res as never, { range: "30d", view: "breakdown" }, { reason: "monthly" });
    expect(repo.breakdown).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv; charset=utf-8");
    expect(res.send).toHaveBeenCalled();
  });

  it("denies refresh without export perm", async () => {
    const { controller } = buildController({ canExport: false, canRead: true });
    await expect(controller.refresh({} as never, { reason: "rotate" })).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("rate-limits repeated refresh per actor/domain", async () => {
    const { controller } = buildController({ canExport: true, canRead: true });
    const first = await controller.refresh({} as never, { reason: "first" });
    expect(first.status).toBe("accepted");
    await expect(controller.refresh({} as never, { reason: "second" })).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});
