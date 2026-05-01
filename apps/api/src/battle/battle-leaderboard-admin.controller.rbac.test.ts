import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { BattleLeaderboardAdminController } from "./battle-leaderboard-admin.controller.js";

function createController(opts: { canRead: boolean }) {
  const requireOneOfPermissions = vi.fn().mockImplementation(async () => {
    if (!opts.canRead) throw new ForbiddenException("forbidden");
    return { actorId: "11111111-1111-4111-8111-111111111111", permissions: ["viewer.audit"] };
  });
  const auth = { requireOneOfPermissions, requirePermission: vi.fn() };
  const repo = {
    list: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 25, summary: {}, total: 0 })
  };
  return {
    auth,
    controller: new BattleLeaderboardAdminController(auth as never, repo as never),
    repo
  };
}

describe("BattleLeaderboardAdminController RBAC", () => {
  it("denies list without read perms", async () => {
    const { controller, repo } = createController({ canRead: false });
    await expect(controller.list({} as never, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.list).not.toHaveBeenCalled();
  });

  it("allows list for viewer.audit and applies window default", async () => {
    const { controller, repo } = createController({ canRead: true });
    await controller.list({} as never, { window: "30d", page: "2" });
    expect(repo.list).toHaveBeenCalled();
    const arg = repo.list.mock.calls[0]?.[0];
    expect(arg?.window).toBe("30d");
    expect(arg?.page).toBe(2);
  });

  it("defaults window to all when omitted", async () => {
    const { controller, repo } = createController({ canRead: true });
    await controller.list({} as never, {});
    expect(repo.list.mock.calls[0]?.[0]?.window).toBe("all");
  });
});
