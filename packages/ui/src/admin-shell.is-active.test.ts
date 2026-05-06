import { describe, expect, it } from "vitest";

import { isAdminNavItemActive } from "./admin-shell.js";

describe("isAdminNavItemActive", () => {
  const base = "/vi";

  it("marks exact path", () => {
    expect(isAdminNavItemActive(`${base}/iam`, base, "/iam", "exact")).toBe(true);
  });

  it("does not mark parent as active on child when match is exact", () => {
    expect(isAdminNavItemActive(`${base}/iam`, base, "/iam/roles", "exact")).toBe(false);
  });

  it("prefix match for nested routes", () => {
    expect(isAdminNavItemActive(`${base}/dictionary`, base, "/dictionary/123", "prefix")).toBe(
      true
    );
  });
});
