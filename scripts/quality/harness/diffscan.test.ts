// High-risk change scanner against real git diffs.
import { mkdirSync, rmdirSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { baselineWeakening, scanDiff } from "./lib/diffscan.mjs";
import { loadPolicy } from "./lib/policy.mjs";
import { blobsAt, worktreeBlobs } from "./lib/git.mjs";
import { CALC_GO, CALC_TEST_GO, PATTERNS, makeFixture, type Fixture } from "./fixture";

let fx: Fixture;
afterEach(() => fx?.cleanup());

const ids = (changes: Record<string, string | null>) => {
  fx?.cleanup();
  fx = makeFixture();
  for (const [rel, content] of Object.entries(changes)) {
    if (content === null) fx.remove(rel);
    else fx.write(rel, content);
  }
  const head = fx.commit("change");
  const policy = loadPolicy(fx.dir);
  return scanDiff(fx.dir, policy, fx.base, head, Object.keys(changes)).map((f: any) => `${f.severity}:${f.id}`);
};

describe("scanDiff", () => {
  it("tracks directory and dangling symlinks without following their targets", () => {
    fx = makeFixture();
    const file = ".claude/skills/link";
    mkdirSync(path.join(fx.dir, ".claude/skills"), { recursive: true });
    mkdirSync(path.join(fx.dir, "target"));
    symlinkSync("../../target", path.join(fx.dir, file));
    const head = fx.commit("directory symlink");
    const policy = loadPolicy(fx.dir);
    let error = "";
    try { scanDiff(fx.dir, policy, fx.base, null, [file]); } catch (e) { error = String(e); }
    expect(error, "directory symlink must scan without error").toBe("");
    expect(worktreeBlobs(fx.dir, [file])[file]).toBe(blobsAt(fx.dir, head, [file])[file]);
    unlinkSync(path.join(fx.dir, file));
    symlinkSync("../../missing", path.join(fx.dir, file));
    expect(worktreeBlobs(fx.dir, [file])[file]).not.toBe(blobsAt(fx.dir, head, [file])[file]);
    expect(worktreeBlobs(fx.dir, [file])[file]).not.toBeNull();
    expect(scanDiff(fx.dir, policy, head, null, [file])).toEqual(scanDiff(fx.dir, policy, head, fx.commit("dangling symlink"), [file]));
  });

  it("distinguishes link type changes and deleted children beneath a replaced directory", () => {
    fx = makeFixture();
    const file = "apps/api-go/internal/calc/calc.go";
    const content = "link-target";
    fx.write(file, content);
    const head = fx.commit("regular file");
    unlinkSync(path.join(fx.dir, file));
    symlinkSync(content, path.join(fx.dir, file));
    expect(worktreeBlobs(fx.dir, [file])[file], "file type changes must invalidate evidence").not.toBe(blobsAt(fx.dir, head, [file])[file]);
    unlinkSync(path.join(fx.dir, file));
    fx.remove("apps/api-go/internal/calc/calc_test.go");
    rmdirSync(path.join(fx.dir, "apps/api-go/internal/calc"));
    writeFileSync(path.join(fx.dir, "apps/api-go/internal/calc"), "replacement");
    expect(worktreeBlobs(fx.dir, [file])[file]).toBeNull();
    expect(() => scanDiff(fx.dir, loadPolicy(fx.dir), head, null, [file])).not.toThrow();
  });

  it("does not follow ancestor links and detects type-only risk changes", () => {
    fx = makeFixture();
    const file = "apps/api-go/internal/calc/calc.go";
    fx.write(file, "link-target");
    const head = fx.commit("file");
    unlinkSync(path.join(fx.dir, file));
    symlinkSync("link-target", path.join(fx.dir, file));
    const policy = loadPolicy(fx.dir);
    policy.riskRules.push({ id: "type_probe", severity: "high", regexps: [/calc\.go$/u], any_change: true });
    expect(scanDiff(fx.dir, policy, head, null, [file]).map((finding: any) => finding.id)).toContain(`type_probe:${file}`);
    unlinkSync(path.join(fx.dir, file));
    fx.remove("apps/api-go/internal/calc/calc_test.go");
    rmdirSync(path.join(fx.dir, "apps/api-go/internal/calc"));
    mkdirSync(path.join(fx.dir, "other"));
    writeFileSync(path.join(fx.dir, "other/calc.go"), "link-target");
    symlinkSync(path.join(fx.dir, "other"), path.join(fx.dir, "apps/api-go/internal/calc"));
    expect(worktreeBlobs(fx.dir, [file])[file]).toBeNull();
    expect(scanDiff(fx.dir, policy, head, null, [file]).map((finding: any) => finding.id)).toContain(`type_probe:${file}`);
  });

  it("checks untracked symlink text against forbidden patterns", () => {
    fx = makeFixture();
    const file = "apps/web/linked.test.ts";
    mkdirSync(path.dirname(path.join(fx.dir, file)), { recursive: true });
    mkdirSync(path.join(fx.dir, `apps/web/${PATTERNS.only}target`));
    symlinkSync(`${PATTERNS.only}target`, path.join(fx.dir, file));
    expect(scanDiff(fx.dir, loadPolicy(fx.dir), fx.base, null, [file]).map((finding: any) => finding.id)).toContain(`test_focus_only:${file}`);
  });

  it("treats a tracked link replaced by a directory as deleted", () => {
    fx = makeFixture();
    const file = "apps/web/linked.test.ts";
    mkdirSync(path.dirname(path.join(fx.dir, file)), { recursive: true });
    symlinkSync("missing", path.join(fx.dir, file));
    const head = fx.commit("link");
    unlinkSync(path.join(fx.dir, file));
    mkdirSync(path.join(fx.dir, file));
    writeFileSync(path.join(fx.dir, file, "child"), "content");
    expect(() => scanDiff(fx.dir, loadPolicy(fx.dir), head, null, [file])).not.toThrow();
    expect(worktreeBlobs(fx.dir, [file])[file]).toBeNull();
  });

  it("flags focus, skips and suppressions in the right files only", () => {
    expect(
      ids({
        "apps/web/a.test.ts": `${PATTERNS.only}"x", () => {});\n${PATTERNS.skip}"y", () => {});\n`,
        "apps/web/b.tsx": `// ${["eslint", "disable-next-line"].join("-")}\nexport const b = 1;\n`,
        "apps/web/c.tsx": `export const c = "${PATTERNS.only} in production code is not a test focus";\n`
      })
    ).toEqual(["forbidden:test_focus_only:apps/web/a.test.ts", "high:test_skip_added:apps/web/a.test.ts", "high:suppression_added:apps/web/b.tsx"]);
  });

  it("flags Go t.Skip, deleted tests and removed assertions", () => {
    expect(ids({ "apps/api-go/internal/calc/calc_test.go": CALC_TEST_GO.replace("if got", `${PATTERNS.goSkip}"x")\n\tif got`) })).toEqual(["high:test_skip_added:apps/api-go/internal/calc/calc_test.go"]);
    expect(ids({ "apps/api-go/internal/calc/calc_test.go": null })).toEqual(["high:test_file_deleted:apps/api-go/internal/calc/calc_test.go"]);
    expect(ids({ "apps/api-go/internal/calc/calc_test.go": CALC_TEST_GO.replace('t.Fatalf("add: got %d want 5", got)', "_ = got") })).toEqual(["high:assertions_reduced:apps/api-go/internal/calc/calc_test.go"]);
  });

  it("forbids swallowing failures in workflows; flags it in scripts", () => {
    const ci = makeFixture();
    const workflow = ci.read(".github/workflows/ci.yml");
    ci.cleanup();
    expect(
      ids({
        ".github/workflows/ci.yml": workflow.replace("run: bash scripts/quality/verify-go.sh", `run: bash scripts/quality/verify-go.sh ${PATTERNS.orTrue}`).replace("timeout-minutes: 30", `timeout-minutes: 30\n    ${PATTERNS.continueOnError}`),
        "scripts/quality/extra.sh": `set -euo pipefail\nfalse ${PATTERNS.orTrue}\n`
      })
    ).toEqual(["forbidden:ci_continue_on_error:.github/workflows/ci.yml", "forbidden:ci_swallowed_failure:.github/workflows/ci.yml", "high:quality_swallowed_failure:scripts/quality/extra.sh"]);
  });

  it("flags whitespace-only diffs; FORMAT_ONLY tasks are exempt", async () => {
    const reformatted = CALC_GO.replace("func Add(a, b int) int { return a + b }", "func Add(a, b int) int {\n\treturn a + b\n}");
    const found = ids({ "apps/api-go/internal/calc/calc.go": reformatted });
    expect(found).toEqual(["high:formatting_only_change:apps/api-go/internal/calc/calc.go"]);
    const { evaluate } = await import("./lib/task.mjs");
    const policy = loadPolicy(fx.dir);
    const finding = [{ id: "formatting_only_change:apps/api-go/internal/calc/calc.go", rule: "formatting_only_change", severity: "high", detail: "" }];
    const owned = { "apps/api-go/internal/calc/calc.go": "b" };
    const mk = (classes: string[]) => ({ spec: { acceptance: [{ id: "A", text: "a" }] }, classification: { classes, change_kind: "non_behavioral" }, evidence: [] });
    expect(evaluate(policy, mk(["FORMAT_ONLY"]), { root: fx.dir, owned, findings: finding }).findingsProblems).toEqual([]);
    expect(evaluate(policy, mk(["TEST_ONLY"]), { root: fx.dir, owned, findings: finding }).findingsProblems[0]).toContain("formatting_only_change");
  });

  it("does not flag ordinary production or test edits", () => {
    expect(ids({ "apps/api-go/internal/calc/calc_test.go": `${CALC_TEST_GO}\nfunc TestMore(t *testing.T) { if Add(1, 1) != 2 { t.Fatal("x") } }\n` })).toEqual([]);
  });

  it("detects weakened baselines but not shrinking ones", () => {
    expect(ids({ "scripts/quality/go-test-skips-baseline.json": JSON.stringify({ min_passed_tests: 0, allowed_skips: { "a::T": "r" } }) })).toEqual([
      "high:baseline_expanded:scripts/quality/go-test-skips-baseline.json:min_passed_tests lowered",
      "high:baseline_expanded:scripts/quality/go-test-skips-baseline.json:allowed_skip_added a::T"
    ]);
    expect(ids({ "scripts/quality/go-test-skips-baseline.json": JSON.stringify({ min_passed_tests: 5, allowed_skips: {} }) })).toEqual([]);
  });
});

describe("baselineWeakening", () => {
  const fe = (violations: object, failures: string[] = [], min = 10) => JSON.stringify({ eslint: { min_linted_files: min, violations }, vitest: { min_test_files: 1, min_tests: min, known_failures: failures, known_skipped: [] } });
  it("frontend debt: added lint debt, known failures, lowered floors", () => {
    expect(baselineWeakening("frontend_debt", fe({ "a.ts": { r: 1 } }), fe({ "a.ts": { r: 2 } }))).toEqual(["lint_debt_added a.ts [r]"]);
    expect(baselineWeakening("frontend_debt", fe({}), fe({}, ["t > x"]))).toEqual(["known_failures_added t > x"]);
    expect(baselineWeakening("frontend_debt", fe({}), fe({}, [], 5))).toEqual(["min_linted_files_lowered 10->5", "min_tests_lowered 10->5"]);
    expect(baselineWeakening("frontend_debt", fe({ "a.ts": { r: 2 } }), fe({ "a.ts": { r: 1 } }))).toEqual([]);
  });
  it("sql conformance: new drift and a lowered statement floor", () => {
    const sql = (drift: object, min = 10) => JSON.stringify({ min_statements_checked: min, known_drift: drift });
    expect(baselineWeakening("sql_conformance", sql({ a: 1 }), sql({ a: 1, b: 1 }))).toEqual(["drift_added b"]);
    expect(baselineWeakening("sql_conformance", sql({ a: 2 }), sql({ a: 1 }, 9))).toEqual(["min_statements_checked_lowered 10->9"]);
  });
  it("deleted or unparseable baselines are weakening", () => {
    expect(baselineWeakening("go_skips", "{}", null)).toEqual(["baseline deleted"]);
    expect(baselineWeakening("go_skips", "{}", "{nope")).toEqual(["unparseable baseline"]);
  });
});
