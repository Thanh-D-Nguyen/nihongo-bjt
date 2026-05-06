import { describe, expect, it } from "vitest";

import { ADMIN_NAV_DATA } from "./admin-nav-data";
import { buildResolvedAdminNav, getShellNavLabel } from "./resolve-admin-nav";

const labels = {
  navGroups: { overview: "OV", content: "CM" },
  navItems: { dictionary: "Dict", overview: "Home" }
};

describe("getShellNavLabel", () => {
  it("resolves nav group and item keys", () => {
    expect(getShellNavLabel(labels, "shell.navGroups.overview")).toBe("OV");
    expect(getShellNavLabel(labels, "shell.navItems.dictionary")).toBe("Dict");
  });
});

describe("buildResolvedAdminNav", () => {
  it("hides items when permission is missing", () => {
    const nav = buildResolvedAdminNav(
      ADMIN_NAV_DATA,
      (k) => getShellNavLabel(labels, k),
      "vi",
      ["admin.content.read"],
      {}
    );
    const allIds = nav.flatMap((g) => g.items.map((i) => i.id));
    expect(allIds).not.toContain("u.users");
  });

  it("includes protected items when permission matches (OR list)", () => {
    const nav = buildResolvedAdminNav(
      ADMIN_NAV_DATA,
      (k) => getShellNavLabel(labels, k),
      "vi",
      ["support.user.read", "admin.content.read"],
      {}
    );
    const allIds = nav.flatMap((g) => g.items.map((i) => i.id));
    expect(allIds).toContain("u.users");
  });

  it("hides all battle items when feature flag is explicitly false", () => {
    const nav = buildResolvedAdminNav(
      ADMIN_NAV_DATA,
      (k) => getShellNavLabel(labels, k),
      "vi",
      ["admin.content.read", "iam.manage"],
      { "adminNav.battle": false }
    );
    const allIds = nav.flatMap((g) => g.items.map((i) => i.id));
    expect(allIds).not.toContain("bt.configs");
  });

  it("shows user ops and analytics drilldown pages when default-off list is empty", () => {
    const nav = buildResolvedAdminNav(
      ADMIN_NAV_DATA,
      (k) => getShellNavLabel(labels, k),
      "vi",
      ["support.user.read", "admin.analytics.view", "iam.manage"],
      {}
    );
    const allIds = nav.flatMap((g) => g.items.map((i) => i.id));
    expect(allIds).toContain("u.users");
    expect(allIds).toContain("an.exec");
    // These are now implemented and visible (no longer in ADMIN_FEATURE_FLAG_DEFAULTS_OFF)
    expect(allIds).toContain("u.360");
    expect(allIds).toContain("u.notes");
    expect(allIds).toContain("u.privacy");
    expect(allIds).toContain("u.export");
  });

  it("uses exact matching for admin hub routes that have child routes", () => {
    const nav = buildResolvedAdminNav(
      ADMIN_NAV_DATA,
      (k) => getShellNavLabel(labels, k),
      "vi",
      ["support.user.read", "admin.analytics.view", "admin.monetization.read", "admin.growth.read"],
      {
        "adminNav.phase11.userOps": true,
        "adminNav.phase11.analyticsExtended": true
      }
    );
    const byId = new Map(nav.flatMap((g) => g.items.map((i) => [i.id, i])));
    expect(byId.get("u.users")?.activeMatch).toBe("exact");
    expect(byId.get("an.exec")?.activeMatch).toBe("exact");
    expect(byId.get("mo.ov")?.activeMatch).toBe("exact");
    expect(byId.get("gr.main")?.activeMatch).toBe("exact");
  });
});
