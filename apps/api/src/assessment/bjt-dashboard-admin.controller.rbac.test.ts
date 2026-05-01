import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { BjtDashboardAdminController } from "./bjt-dashboard-admin.controller.js";

function build(opts: { canRead: boolean }) {
  const auth = {
    requireOneOfPermissions: vi.fn().mockImplementation(async () => {
      if (!opts.canRead) throw new ForbiddenException("forbidden");
      return { actorId: "55555555-5555-4555-8555-555555555555", permissions: new Set<string>() };
    })
  };
  const repo = {
    summary: vi.fn().mockResolvedValue({
      generatedAt: new Date().toISOString(),
      range: { recentDays: 30 },
      kpis: {
        learnersTotal: 0,
        learnersByLevel: [],
        publishedMockExams: 0,
        sessionsRecent: 0,
        sessionsCompletedRecent: 0,
        passRateRecent: null,
        avgScoreRecent: null
      },
      passRateByLevelRecent: [],
      passRateTimeseries: [],
      topTopicsRecent: [],
      upcomingMockExams: [],
      dropOffSections: [],
      freshness: { lastSessionAt: null, lastQuestionAt: null }
    })
  };
  return { auth, repo, ctrl: new BjtDashboardAdminController(auth as never, repo as never) };
}

describe("BjtDashboardAdminController RBAC", () => {
  it("denies summary without analytics/audit perms", async () => {
    const { ctrl, repo } = build({ canRead: false });
    await expect(ctrl.summary({} as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.summary).not.toHaveBeenCalled();
  });

  it("allows summary for any analytics-read role", async () => {
    const { ctrl, repo, auth } = build({ canRead: true });
    const result = await ctrl.summary({} as never);
    expect(repo.summary).toHaveBeenCalledTimes(1);
    expect(auth.requireOneOfPermissions).toHaveBeenCalledWith(
      {},
      expect.arrayContaining(["analytics.view", "viewer.audit", "admin.analytics.view"])
    );
    expect(result.kpis).toBeDefined();
    expect(result.range.recentDays).toBe(30);
  });
});
