import { describe, expect, it } from "vitest";

import {
  ToolFailure,
  buildBaseline,
  collectLintDebt,
  collectTestDebt,
  compareDebt,
  validateBaseline
} from "./frontend-debt-lib.mjs";

const root = "/repo";

const lintFile = (rel: string, messages: Array<{ ruleId: string | null; severity: 1 | 2; fatal?: boolean; message?: string }>) => ({
  filePath: `${root}/${rel}`,
  errorCount: messages.filter((m) => m.severity === 2).length,
  messages: messages.map((m) => ({ line: 1, column: 1, message: m.message ?? "msg", ...m }))
});

const any = { ruleId: "@typescript-eslint/no-explicit-any", severity: 2 as const };
const unused = { ruleId: "@typescript-eslint/no-unused-vars", severity: 2 as const };
const deps = { ruleId: "react-hooks/exhaustive-deps", severity: 1 as const };

const lint = (files: ReturnType<typeof lintFile>[], exitCode?: number) =>
  collectLintDebt({
    report: files,
    exitCode: exitCode ?? (files.some((f) => f.errorCount > 0) ? 1 : 0),
    repoRoot: root
  });

type TestState = "passed" | "failed" | "skipped" | "pending";
const vitestReport = (
  modules: Array<{ file: string; errors?: string[]; tests: Array<[string, TestState]> }>,
  extra: Record<string, unknown> = {}
) => ({
  schema: "frontend-debt-vitest/1",
  reason: "passed",
  unhandledErrors: [],
  modules: modules.map((m) => ({
    file: m.file,
    state: "passed",
    errors: m.errors ?? [],
    tests: m.tests.map(([name, state]) => ({ name, state, mode: "run" }))
  })),
  ...extra
});

const tests = (report: ReturnType<typeof vitestReport>, exitCode?: number) => {
  const failing = report.modules.some((m) => m.errors.length || m.tests.some((t) => t.state === "failed"));
  return collectTestDebt({ report, exitCode: exitCode ?? (failing ? 1 : 0) });
};

const healthyModules = [
  { file: "apps/web/a.test.ts", tests: [["A > works", "passed"]] as Array<[string, TestState]> },
  { file: "apps/web/b.test.ts", tests: [["B > known broken", "failed"]] as Array<[string, TestState]> }
];

const baselineFrom = (lintFiles: ReturnType<typeof lintFile>[], modules = healthyModules) =>
  validateBaseline(buildBaseline({ lint: lint(lintFiles), tests: tests(vitestReport(modules)) }));

const verdict = (baseline: ReturnType<typeof baselineFrom>, lintFiles: ReturnType<typeof lintFile>[], modules = healthyModules) =>
  compareDebt(baseline, { lint: lint(lintFiles), tests: tests(vitestReport(modules)) });

describe("frontend debt ratchet: identity, not counts", () => {
  const base = baselineFrom([lintFile("apps/web/x.tsx", [any, any, deps]), lintFile("apps/web/y.tsx", [unused])]);

  it("is clean when current debt equals the baseline", () => {
    expect(verdict(base, [lintFile("apps/web/x.tsx", [any, any, deps]), lintFile("apps/web/y.tsx", [unused])])).toEqual({
      newDebt: [],
      resolved: [],
      floors: []
    });
  });

  it("Scenario A/C: fixing an old error and adding a new one elsewhere with the same total is NEW debt", () => {
    const { newDebt, resolved } = verdict(base, [
      lintFile("apps/web/x.tsx", [any, any, deps]),
      lintFile("apps/web/y.tsx", []),
      lintFile("apps/web/z.tsx", [unused])
    ]);
    expect(newDebt).toEqual([{ kind: "lint", id: "apps/web/z.tsx [error:@typescript-eslint/no-unused-vars]", delta: 1 }]);
    expect(resolved).toEqual([{ kind: "lint", id: "apps/web/y.tsx [error:@typescript-eslint/no-unused-vars]", delta: 1 }]);
  });

  it("Scenario C: swapping one rule for another in the same file is NEW debt", () => {
    const { newDebt } = verdict(base, [lintFile("apps/web/x.tsx", [any, unused, deps]), lintFile("apps/web/y.tsx", [unused])]);
    expect(newDebt.map((d) => d.id)).toEqual(["apps/web/x.tsx [error:@typescript-eslint/no-unused-vars]"]);
  });

  it("an extra violation of an already-baselined file+rule is NEW debt", () => {
    const { newDebt } = verdict(base, [lintFile("apps/web/x.tsx", [any, any, any, deps]), lintFile("apps/web/y.tsx", [unused])]);
    expect(newDebt).toEqual([{ kind: "lint", id: "apps/web/x.tsx [error:@typescript-eslint/no-explicit-any]", delta: 1 }]);
  });

  it("moving code (line numbers change) is not debt", () => {
    const moved = lintFile("apps/web/x.tsx", [any, any, deps]);
    moved.messages.forEach((m, i) => Object.assign(m, { line: 500 + i }));
    expect(verdict(base, [moved, lintFile("apps/web/y.tsx", [unused])]).newDebt).toEqual([]);
  });

  it("a newly unparseable file is NEW debt, keyed as a parse error", () => {
    const { newDebt } = verdict(base, [
      lintFile("apps/web/x.tsx", [any, any, deps]),
      lintFile("apps/web/y.tsx", [unused]),
      lintFile("apps/web/broken.ts", [{ ruleId: null, severity: 2, fatal: true, message: "Parsing error" }])
    ]);
    expect(newDebt.map((d) => d.id)).toEqual(["apps/web/broken.ts [error:<parse-error>]"]);
  });

  it("Scenario B: fixing the known failing test but breaking another is NEW debt", () => {
    const { newDebt, resolved } = verdict(base, [lintFile("apps/web/x.tsx", [any, any, deps]), lintFile("apps/web/y.tsx", [unused])], [
      { file: "apps/web/a.test.ts", tests: [["A > works", "failed"]] },
      { file: "apps/web/b.test.ts", tests: [["B > known broken", "passed"]] }
    ]);
    expect(newDebt).toEqual([{ kind: "failing-test", id: "apps/web/a.test.ts > A > works", delta: 1 }]);
    expect(resolved).toEqual([{ kind: "failing-test", id: "apps/web/b.test.ts > B > known broken", delta: 1 }]);
  });

  it("a test file that fails to load (import/collection error) is NEW debt", () => {
    const { newDebt } = verdict(base, [lintFile("apps/web/x.tsx", [any, any, deps]), lintFile("apps/web/y.tsx", [unused])], [
      ...healthyModules,
      { file: "apps/web/c.test.ts", errors: ["Failed to load module"], tests: [] }
    ]);
    expect(newDebt.map((d) => d.id)).toEqual(["apps/web/c.test.ts > <module error>"]);
  });

  it("hiding a test with .skip/.todo is NEW debt", () => {
    const { newDebt } = verdict(base, [lintFile("apps/web/x.tsx", [any, any, deps]), lintFile("apps/web/y.tsx", [unused])], [
      { file: "apps/web/a.test.ts", tests: [["A > works", "skipped"]] },
      healthyModules[1]
    ]);
    expect(newDebt).toEqual([{ kind: "skipped-test", id: "apps/web/a.test.ts > A > works", delta: 1 }]);
  });

  it("reports fixed debt as resolved so the baseline must shrink", () => {
    const { newDebt, resolved } = verdict(base, [lintFile("apps/web/x.tsx", [any, deps]), lintFile("apps/web/y.tsx", [unused])]);
    expect(newDebt).toEqual([]);
    expect(resolved).toEqual([{ kind: "lint", id: "apps/web/x.tsx [error:@typescript-eslint/no-explicit-any]", delta: 1 }]);
  });

  it("flags a drop in collected tests or linted files below the floor", () => {
    const { floors } = verdict(base, [lintFile("apps/web/x.tsx", [any, any, deps])], [healthyModules[1]]);
    expect(floors).toHaveLength(3);
  });
});

describe("Scenario E: ESLint infrastructure failures fail closed", () => {
  it.each([
    ["config/crash exit code 2", [], 2],
    ["exit 1 but no errors in the report (output not understood)", [lintFile("a.ts", [deps])], 1],
    ["exit 0 but errors in the report", [lintFile("a.ts", [any])], 0],
    ["zero files linted", [], 0]
  ])("%s", (_name, files, exitCode) => {
    expect(() => collectLintDebt({ report: files, exitCode, repoRoot: root })).toThrow(ToolFailure);
  });

  it("rejects a report that is not an ESLint JSON array", () => {
    expect(() => collectLintDebt({ report: { results: [] }, exitCode: 0, repoRoot: root })).toThrow(ToolFailure);
    expect(() => collectLintDebt({ report: [{ file: "a.ts" }], exitCode: 0, repoRoot: root })).toThrow(ToolFailure);
  });

  it("rejects an errorCount that disagrees with the messages", () => {
    const file = { ...lintFile("a.ts", [any]), errorCount: 3 };
    expect(() => collectLintDebt({ report: [file], exitCode: 1, repoRoot: root })).toThrow(ToolFailure);
  });

  it("ignores files outside the git index but still checks exit-code consistency", () => {
    const result = collectLintDebt({
      report: [lintFile("tmp/scratch.mts", [any]), lintFile("apps/web/x.tsx", [])],
      exitCode: 1,
      repoRoot: root,
      isMeasured: (rel: string) => !rel.startsWith("tmp/")
    });
    expect(result).toMatchObject({ lintedFiles: 1, errorCount: 0, violations: {}, unmeasured: ["tmp/scratch.mts"] });
  });
});

describe("Scenario D: test runner infrastructure failures fail closed", () => {
  const ok = vitestReport(healthyModules);

  it.each([
    ["runner crash (exit code 2)", ok, 2],
    ["killed / no exit code", ok, null],
    ["report missing (config or dependency load failure before the run)", null, 1],
    ["report shape changed", { ...ok, schema: "something-else" }, 1],
    ["run interrupted (e.g. timeout, bail)", { ...ok, reason: "interrupted" }, 1],
    ["unhandled error alongside the known failure", { ...ok, unhandledErrors: ["TypeError: boom"] }, 1],
    ["zero tests collected", vitestReport([]), 0],
    ["exit 1 without any identifiable failing test", vitestReport([healthyModules[0]]), 1],
    ["exit 0 while a test failed", ok, 0],
    ["a test that never finished", vitestReport([{ file: "a.test.ts", tests: [["A > hangs", "pending"]] }]), 1]
  ])("%s", (_name, report, exitCode) => {
    expect(() => collectTestDebt({ report, exitCode })).toThrow(ToolFailure);
  });
});

describe("baseline handling", () => {
  it("rejects the legacy aggregate-count baseline format", () => {
    expect(() =>
      validateBaseline({ eslint_errors: 120, eslint_warnings: 25, failing_test_files: 1, failing_test_cases: 1 })
    ).toThrow(ToolFailure);
  });

  it("round-trips: a baseline built from the current state has no diff", () => {
    const files = [lintFile("apps/web/x.tsx", [any, deps])];
    const current = { lint: lint(files), tests: tests(vitestReport(healthyModules)) };
    expect(compareDebt(validateBaseline(buildBaseline(current)), current)).toEqual({ newDebt: [], resolved: [], floors: [] });
  });
});
