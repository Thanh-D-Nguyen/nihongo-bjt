import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  clearSqlFileCache,
  loadSqlFileSync,
  resolveMonorepoRoot,
  resolveSqlFilePath
} from "./load-sql.js";

describe("load-sql", () => {
  afterEach(() => {
    clearSqlFileCache();
    delete process.env.NIHONGO_BJT_REPO_ROOT;
  });

  it("resolves monorepo root from package location", () => {
    const root = resolveMonorepoRoot();
    expect(existsSync(join(root, "database", "scripts", "read"))).toBe(true);
  });

  it("loads read SQL by relative path", () => {
    const sql = loadSqlFileSync("read", "reporting_user_learning_dashboard_by_user.sql");
    expect(sql).toContain("reporting.v_user_learning_dashboard_summary");
    expect(sql).toContain("$1::uuid");
  });

  it("honors NIHONGO_BJT_REPO_ROOT", () => {
    const root = resolveMonorepoRoot();
    delete process.env.NIHONGO_BJT_REPO_ROOT;
    process.env.NIHONGO_BJT_REPO_ROOT = root;
    const sql = loadSqlFileSync("read", "reporting_user_learning_dashboard_by_user.sql");
    expect(sql).toContain("user_id");
  });

  it("resolveSqlFilePath accepts explicit root", () => {
    const root = resolveMonorepoRoot();
    const path = resolveSqlFilePath("read", "reporting_user_learning_dashboard_by_user.sql", {
      root
    });
    expect(path.endsWith("reporting_user_learning_dashboard_by_user.sql")).toBe(true);
  });
});
