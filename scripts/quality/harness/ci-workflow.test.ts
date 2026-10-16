// Guards two regressions that broke the first push CI of the Oracle release:
// release scripts must lint clean, and the PARTIAL-acceptance switch must not
// be visible to any step except the lifecycle check.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ROOT } from "./fixture";

describe("CI workflow hygiene", () => {
  it("exposes QUALITY_ACCEPT_PARTIAL only on the Lifecycle check step", () => {
    const lines = readFileSync(path.join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8").split("\n");
    const indent = (line: string) => line.length - line.trimStart().length;
    const uses = lines.map((line, index) => ({ line, index })).filter(({ line }) => line.includes("QUALITY_ACCEPT_PARTIAL:"));
    expect(uses.length, "the acceptance switch must still be wired for the lifecycle check").toBeGreaterThan(0);
    for (const { line, index } of uses) {
      // Walk up to the enclosing `env:` mapping, then to the step or job that owns it.
      let cursor = index - 1;
      while (cursor >= 0 && !(lines[cursor].trim() === "env:" && indent(lines[cursor]) < indent(line))) cursor -= 1;
      expect(cursor, "QUALITY_ACCEPT_PARTIAL must live inside an env: block").toBeGreaterThanOrEqual(0);
      const envIndent = indent(lines[cursor]);
      expect(envIndent, "job-level env leaks the switch into the harness self-test").toBeGreaterThan(4);
      let owner = cursor - 1;
      while (owner >= 0 && !lines[owner].trimStart().startsWith("- name:")) owner -= 1;
      expect(lines[owner]?.trim()).toBe("- name: Lifecycle check");
    }
  });

  it("keeps release scripts free of ESLint errors", () => {
    const result = spawnSync("pnpm", ["exec", "eslint", "--max-warnings", "0", "scripts/release"], {
      cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });
});
