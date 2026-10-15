// Structured runners: outcomes come from machine-readable test output, never
// from exit codes alone. Uses real `go test -json` in a temp module.
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { compilePolicy, loadPolicy } from "./lib/policy.mjs";
import { classifyVitestReport, judgeGreen, judgeRed, runGoPackage, runVitestFile, targetId, validateTarget } from "./lib/runners.mjs";
import { REPO_ROOT, PATTERNS } from "./fixture";

const policy = loadPolicy(REPO_ROOT);
let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "runner-"));
  const mod = path.join(root, policy.raw.runners.go.module_dir);
  mkdirSync(path.join(mod, "internal/ok"), { recursive: true });
  mkdirSync(path.join(mod, "internal/broken"), { recursive: true });
  writeFileSync(path.join(mod, "go.mod"), "module example.com/r\n\ngo 1.21\n");
  writeFileSync(
    path.join(mod, "internal/ok/ok_test.go"),
    `package ok
import "testing"
func TestPass(t *testing.T) {}
func TestFail(t *testing.T) { t.Fatalf("want 3 got 2") }
func TestSkip(t *testing.T) { ${PATTERNS.goSkip}"no db") }
func TestSub(t *testing.T) { t.Run("inner", func(t *testing.T) { t.Fatal("inner broke") }) }
`
  );
  writeFileSync(path.join(mod, "internal/broken/b_test.go"), `package broken\nimport "testing"\nfunc TestX(t *testing.T) { Missing() }\n`);
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const go = (pkg: string, test: string, expect?: string) => ({ runner: "go", package: pkg, test, expect });

describe("go runner", () => {
  it("classifies pass / fail / skip / not found / subtest failure", () => {
    const targets = [go("./internal/ok", "TestPass"), go("./internal/ok", "TestFail"), go("./internal/ok", "TestSkip"), go("./internal/ok", "TestNope"), go("./internal/ok", "TestSub")];
    const { results } = runGoPackage(root, policy, "./internal/ok", targets);
    expect(results.map((r: any) => r.outcome)).toEqual(["PASS", "FAIL", "SKIP", "NOT_FOUND", "FAIL"]);
    expect(results[1].output).toContain("want 3 got 2");
    expect(results[4].output).toContain("inner broke");
  });

  it("a compile failure is BUILD_FAIL for every target", () => {
    const { results } = runGoPackage(root, policy, "./internal/broken", [go("./internal/broken", "TestX")]);
    expect(results[0].outcome).toBe("BUILD_FAIL");
  });
});

describe("RED judgement", () => {
  const results = (outcome: string, output = "") => [{ id: "go:./p:TestX", outcome, output }];
  const t = [go("./p", "TestX", "want 3 got 2")];
  it("accepts only an executed failure containing the expected text", () => {
    expect(judgeRed(policy, t, results("FAIL", "x_test.go:3: want 3 got 2")).valid).toBe(true);
    expect(judgeRed(policy, t, results("FAIL", "want 4 got 2")).valid).toBe(false);
    expect(judgeRed(policy, t, results("PASS")).valid).toBe(false);
    expect(judgeRed(policy, t, results("SKIP")).valid).toBe(false);
    expect(judgeRed(policy, t, results("NOT_FOUND")).valid).toBe(false);
    expect(judgeRed(policy, t, results("BUILD_FAIL", "want 3 got 2")).valid).toBe(false);
    expect(judgeRed(policy, t, results("FAIL", "want 3 got 2 — dial tcp: connection refused")).valid).toBe(false);
    expect(judgeRed(policy, [], []).valid).toBe(false);
  });
  it("GREEN needs every target to pass", () => {
    expect(judgeGreen(t, results("PASS")).valid).toBe(true);
    expect(judgeGreen(t, results("SKIP")).valid).toBe(false);
    expect(judgeGreen([], []).valid).toBe(false);
  });
});

describe("vitest report classification", () => {
  const report = (modules: unknown[], extra = {}) => ({ schema: "frontend-debt-vitest/1", reason: "passed", unhandledErrors: [], modules, ...extra });
  const target = (test: string) => ({ runner: "vitest", file: "a.test.ts", test });
  it("maps states and module errors", () => {
    const r = report([{ file: "a.test.ts", errors: [], tests: [{ name: "S > ok", state: "passed" }, { name: "S > bad", state: "failed", errors: ["expected 1 to be 2"] }, { name: "S > off", state: "skipped" }] }]);
    expect(classifyVitestReport(r, "a.test.ts", [target("S > ok"), target("S > bad"), target("S > off"), target("S > none")]).map((x: any) => x.outcome)).toEqual(["PASS", "FAIL", "SKIP", "NOT_FOUND"]);
    expect(classifyVitestReport(report([{ file: "a.test.ts", errors: ["SyntaxError"], tests: [] }]), "a.test.ts", [target("S > ok")])[0].outcome).toBe("BUILD_FAIL");
    expect(classifyVitestReport(report([]), "a.test.ts", [target("S > ok")])[0].outcome).toBe("NOT_FOUND");
  });
  it("interrupted runs, unhandled errors and malformed reports are tool failures", () => {
    expect(() => classifyVitestReport(report([], { reason: "interrupted" }), "a.test.ts", [])).toThrow(/interrupted/u);
    expect(() => classifyVitestReport(report([], { unhandledErrors: ["boom"] }), "a.test.ts", [])).toThrow(/unhandled/u);
    expect(() => classifyVitestReport({ modules: [] }, "a.test.ts", [])).toThrow(/unexpected shape/u);
  });
});

describe("target validation", () => {
  it("rejects malformed targets and missing expectations", () => {
    expect(validateTarget(go("internal/x", "TestA"))).toHaveLength(1);
    expect(validateTarget(go("./internal/x", "TestA/sub"))).toHaveLength(1);
    expect(validateTarget(go("./../x", "TestA"))).toHaveLength(1);
    expect(validateTarget(go("./internal/x", "TestA"), { requireExpect: true })).toHaveLength(1);
    expect(validateTarget({ runner: "vitest", file: "/abs/a.test.ts", test: "x" })).toHaveLength(1);
    expect(validateTarget({ runner: "jest", file: "a.test.ts", test: "x" })).toHaveLength(1);
    expect(targetId({ runner: "vitest", file: "a.test.ts", test: "S > t" })).toBe("vitest:a.test.ts::S > t");
  });
});

describe("INDEPENDENT-REVIEW HARNESS-001 assertion provenance", () => {
  it("Vitest RED requires assertion failures rather than matching runtime error text", () => {
    writeFileSync(path.join(root, "package.json"), '{"private":true,"type":"module"}\n');
    mkdirSync(path.join(root, "scripts/quality"), { recursive: true });
    copyFileSync(path.join(REPO_ROOT, "scripts/quality/vitest-debt-reporter.mjs"), path.join(root, "scripts/quality/vitest-debt-reporter.mjs"));
    symlinkSync(path.join(REPO_ROOT, "node_modules"), path.join(root, "node_modules"), "dir");
    writeFileSync(path.join(root, "vitest.config.mjs"), 'export default { test: { include: ["runtime.test.mjs"], passWithNoTests: false } };\n');
    writeFileSync(path.join(root, "runtime.test.mjs"), `import { it, expect } from "vitest";
it("assertion", () => { expect(1).toBe(2); });
it("type error", () => { throw new TypeError("expected 1 to be 2"); });
it("range error", () => { throw new RangeError("expected 1 to be 2"); });
it("plain error", () => { throw new Error("expected 1 to be 2"); });
`);
    const raw = structuredClone(policy.raw);
    raw.runners.vitest.default_config = "vitest.config.mjs";
    raw.runners.vitest.configs = [];
    const fixturePolicy = compilePolicy(raw);
    const targets = ["assertion", "type error", "range error", "plain error"].map((test) => ({ runner: "vitest", file: "runtime.test.mjs", test, expect: "expected 1 to be 2" }));
    const run = runVitestFile(root, fixturePolicy, "runtime.test.mjs", targets);
    expect(run.results.map((r: { outcome: string }) => r.outcome)).toEqual(["FAIL", "FAIL", "FAIL", "FAIL"]);
    expect(judgeRed(fixturePolicy, targets.slice(0, 1), run.results).valid).toBe(true);
    for (const target of targets.slice(1)) {
      expect(judgeRed(fixturePolicy, [target], run.results).valid, target.test).toBe(false);
    }
  });
});
