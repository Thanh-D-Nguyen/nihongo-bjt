// Write guard (Claude Code PreToolUse hook) and gate evaluation edge cases.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { realpathSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import { decidePath, decideToolCall, shellWriteTargets } from "./lib/guard.mjs";
import { loadPolicy } from "./lib/policy.mjs";
import { evaluate, validateBlockerProtocol } from "./lib/task.mjs";
import { REPO_ROOT, makeFixture, type Fixture } from "./fixture";

const policy = loadPolicy(REPO_ROOT);
const task = (over: Record<string, unknown> = {}) => ({
  id: "T-1",
  spec: { acceptance: [{ id: "AC1", text: "x" }] },
  classification: { classes: ["DOMAIN_LOGIC"], change_kind: "modify" },
  red_exception: null,
  evidence: [],
  ...over
});

let fx: Fixture | undefined;
afterEach(() => {
  fx?.cleanup();
  fx = undefined;
});

describe("decidePath", () => {
  const decide = (rel: string, t: unknown) => decidePath(REPO_ROOT, policy, rel, { taskOverride: t }).decision;
  it("docs are always writable; code needs a classified task", () => {
    expect(decide("docs/spec/index.md", null)).toBe("allow");
    expect(decide("apps/api-go/internal/career/store.go", task({ classification: null }))).toBe("deny");
    expect(decide("apps/api-go/internal/career/store_test.go", task())).toBe("allow");
  });
  it("production waits for VALID_RED unless an exception was declared", () => {
    expect(decide("apps/api-go/internal/career/store.go", task())).toBe("deny");
    expect(decide("apps/api-go/internal/career/store.go", task({ evidence: [{ kind: "red", outcome: "VALID_RED", production_at_base: true }] }))).toBe("allow");
    expect(decide("apps/api-go/internal/career/store.go", task({ evidence: [{ kind: "red", outcome: "INVALID_RED", production_at_base: true }] }))).toBe("deny");
    expect(decide("apps/api-go/internal/career/store.go", task({ red_exception: { category: "new_component", reason: "x" } }))).toBe("allow");
  });
  it("paths outside the task's classes and closed tasks are denied", () => {
    expect(decide("apps/api-go/internal/realtime/hub.go", task({ red_exception: { category: "new_component", reason: "x" } }))).toBe("deny");
    expect(decide(".github/workflows/ci.yml", task({ red_exception: { category: "new_component", reason: "x" } }))).toBe("deny");
    expect(decide("apps/api-go/internal/career/store_test.go", task({ closed: { status: "VERIFIED" } }))).toBe("deny");
  });
});

describe("task record protection", () => {
  it("allows declaration edits but denies evidence/closure edits through editor tools", () => {
    fx = makeFixture();
    expect(fx.run("begin", "FX-1", "t").code).toBe(0);
    const rel = "tasks/FX-1.json";
    const content = fx.read(rel);
    const tamper = (mutate: (t: ReturnType<typeof JSON.parse>) => void) => {
      const t = JSON.parse(content);
      mutate(t);
      return decideToolCall(fx!.dir, loadPolicy(fx!.dir), "Write", { file_path: path.join(fx!.dir, rel), content: JSON.stringify(t) }).decision;
    };
    expect(tamper((t) => (t.spec.acceptance = [{ id: "AC1", text: "y" }]))).toBe("allow");
    expect(tamper((t) => (t.risk_acknowledgements = [{ finding: "a", reason: "b" }]))).toBe("allow");
    expect(tamper((t) => t.evidence.push({ kind: "review", verdict: "APPROVE" }))).toBe("deny");
    expect(tamper((t) => (t.closed = { status: "VERIFIED" }))).toBe("deny");
    expect(tamper((t) => (t.state = "CLOSED"))).toBe("deny");
    expect(tamper((t) => (t.start_head = "0".repeat(40)))).toBe("deny");
    expect(decideToolCall(fx.dir, loadPolicy(fx.dir), "Bash", { command: `echo '{}' > ${rel}` }).decision).toBe("deny");
  });
});

describe("shell write heuristics", () => {
  const targets = (cmd: string) => shellWriteTargets(REPO_ROOT, cmd).sort();
  it("finds redirect, sed -i, cp/mv/rm and git checkout targets", () => {
    expect(targets("echo x > apps/web/app/page.tsx")).toEqual(["apps/web/app/page.tsx"]);
    expect(targets("cat >> 'apps/web/app/page.tsx' <<EOF")).toEqual(["apps/web/app/page.tsx"]);
    expect(targets("sed -i '' s/a/b/ apps/api-go/internal/career/store.go")).toEqual(["apps/api-go/internal/career/store.go"]);
    expect(targets("git checkout -- apps/api-go/go.mod")).toEqual(["apps/api-go/go.mod"]);
    expect(targets("rm scripts/quality/verify-go.sh")).toEqual(["scripts/quality/verify-go.sh"]);
  });
  it("ignores reads, /dev/null, fd redirects, branch names and the harness itself", () => {
    expect(targets("grep -r foo apps/web > /dev/null 2>&1")).toEqual([]);
    expect(targets("rg Discount apps/api-go/internal")).toEqual([]);
    expect(targets("git checkout feature/foo")).toEqual([]);
    expect(targets("node -e 'const f = (a) => a > 1'")).toEqual([]);
    expect(targets("pnpm quality red --go ./internal/x:TestY > /tmp/out")).toEqual([]);
  });
});

describe("hook process", () => {
  it("emits explicit native allow/deny decisions", () => {
    fx = makeFixture();
    const root = realpathSync(fx.dir);
    const run = (input: object) =>
      spawnSync("node", [path.join(REPO_ROOT, "scripts/quality/harness/hook.mjs")], { input: JSON.stringify(input), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: root, QUALITY_GUARD: "" } });
    const denied = run({ tool_name: "Write", tool_input: { file_path: path.join(root, "apps/api-go/internal/realtime/zz_probe.go"), content: "x" } });
    expect(denied.status).toBe(0);
    expect(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision).toBe("deny");
    expect(JSON.parse(run({ tool_name: "Write", tool_input: { file_path: path.join(root, "docs/zz-probe.md"), content: "x" } }).stdout).hookSpecificOutput.permissionDecision).toBe("allow");
    expect(JSON.parse(run({ tool_name: "Read", tool_input: { file_path: "x" } }).stdout).hookSpecificOutput.permissionDecision).toBe("allow");
  });
});

describe("evaluate", () => {
  const owned = { "apps/api-go/internal/career/store_test.go": "b1" };
  it("a suite summary claiming PASS with unexpected skips or nothing executed is not PASS", () => {
    const t = task({ classification: { classes: ["TEST_ONLY"], change_kind: "non_behavioral" } });
    const suite = (accounting: object) => ({ seq: 1, kind: "suite", gate: "suite_go", exit_code: 0, result: "PASS", accounting, fingerprint: undefined as string | undefined });
    const run = (accounting: object) => {
      const e = suite(accounting);
      const fp = evaluate(policy, { ...t, evidence: [] }, { root: REPO_ROOT, owned }).fingerprint;
      e.fingerprint = fp;
      return evaluate(policy, { ...t, evidence: [e] }, { root: REPO_ROOT, owned }).gates.suite_go.status;
    };
    expect(run({ executed: 5, passed: 5, skipped: 0, expected_skips: 0, unexpected_skips: 0 })).toBe("PASS");
    expect(run({ executed: 5, passed: 4, skipped: 1, expected_skips: 0, unexpected_skips: 1 })).toBe("FAIL");
    expect(run({ executed: 0, passed: 0, skipped: 0, expected_skips: 0, unexpected_skips: 0 })).toBe("FAIL");
  });

  it("a RED counts only for the recorded expectation, at base production code, for a test that still exists", () => {
    const id = "go:./internal/realtime:TestHub_RegisterUnregister";
    const red = (over: Record<string, unknown> = {}) => ({ seq: 1, kind: "red", outcome: "VALID_RED", production_at_base: true, targets: [{ id, valid: true }], expects: { [id]: "recorded text" }, ...over });
    const status = (expectText: string, evidence: object, testName = "TestHub_RegisterUnregister") =>
      evaluate(policy, task({ red_targets: [{ runner: "go", package: "./internal/realtime", test: testName, expect: expectText }], evidence: [evidence] }), { root: REPO_ROOT, owned }).gates.red.status;
    expect(status("recorded text", red())).toBe("PASS");
    expect(status("edited afterwards", red())).toBe("MISSING");
    expect(status("recorded text", red({ production_at_base: false }))).toBe("MISSING");
    expect(status("recorded text", red({ outcome: "INVALID_RED" }))).toBe("MISSING");
    expect(status("recorded text", red(), "TestDeletedAfterRed")).toBe("INVALID");
  });

  it("a review binds to the reviewed content: approval of an older fingerprint is STALE", () => {
    const t = task({ classification: { classes: ["CROSS_CUTTING"], change_kind: "refactor" } });
    const fp = evaluate(policy, t, { root: REPO_ROOT, owned }).fingerprint;
    const review = (over: object) => ({ seq: 1, kind: "review", mode: "fresh_session", reviewer: "r", verdict: "APPROVE", open_findings: 0, fingerprint: fp, ...over });
    const status = (e: object) => evaluate(policy, { ...t, evidence: [e] }, { root: REPO_ROOT, owned }).gates.review.status;
    expect(status(review({}))).toBe("PASS");
    expect(status(review({ fingerprint: "f".repeat(64) }))).toBe("STALE");
    expect(status(review({ verdict: "CHANGES_REQUESTED" }))).toBe("FAIL");
    expect(status(review({ open_findings: 1 }))).toBe("FAIL");
    expect(status(review({ mode: "self" }))).toBe("INVALID");
  });

  it("blocker protocol validation", () => {
    expect(validateBlockerProtocol(policy, "suite_harness", {})[0]).toContain("cannot be BLOCKED");
    expect(validateBlockerProtocol(policy, "nope", {})[0]).toContain("unknown gate");
    const protocol = { reproduced: true, error: "external account unavailable", workaround_attempted: "two local recovery paths", why_not_viable: "human account login unavailable", remaining: { kind: "credential_unavailable" }, capability_required: "account owner login", recovery_ids: ["r"], alternatives: [{ id: "playwright-local-webserver", attempted: true, result: "requires real OAuth account" }, { id: "playwright-staging-config", attempted: true, result: "account inaccessible" }] };
    const evidence = [{ kind: "recovery", id: "r", outcome: "EXHAUSTED", fingerprint: "fp", attempts: [{ recipe: "local", exit_code: 1, verification_exit: 1 }, { recipe: "staging", exit_code: 1, verification_exit: 1 }] }];
    expect(validateBlockerProtocol(policy, "browser_e2e", protocol, { evidence }, "fp")).toEqual([]);
  });
});

describe("independent review wrapper", () => {
  it("parses only a well-formed trailing verdict line", async () => {
    const { parseVerdict } = await import("./lib/review.mjs");
    expect(parseVerdict('notes\n{"verdict":"APPROVE","open_findings":0,"findings":[]}\n')).toMatchObject({ verdict: "APPROVE", open_findings: 0 });
    expect(parseVerdict('```json\n{"verdict":"CHANGES_REQUESTED","open_findings":2}\n```')).toMatchObject({ open_findings: 2 });
    expect(() => parseVerdict("LGTM!")).toThrow(/no valid verdict/u);
    expect(() => parseVerdict('{"verdict":"SURE","open_findings":0}')).toThrow(/no valid verdict/u);
  });

  it("runs a fresh reviewer process with the package on stdin and records a CHANGES_REQUESTED verdict as a failed gate", () => {
    fx = makeFixture();
    expect(fx.run("begin", "FX-1", "t").code).toBe(0);
    expect(fx.run("spec", "--acceptance", "a").code).toBe(0);
    expect(fx.run("classify", "CI_QUALITY_SYSTEM", "--kind", "add", "--red-exception", "config_only", "--reason", "x").code).toBe(0);
    fx.write("scripts/quality/x.sh", "#!/usr/bin/env bash\nset -euo pipefail\n");
    const reviewer = `pkg="$(cat)"; printf '%s' "$pkg" | grep -q "UNTRUSTED CLAIMS" && printf '%s' "$pkg" | grep -q "scripts/quality/x.sh" && echo '{"verdict":"CHANGES_REQUESTED","open_findings":1,"findings":[{"severity":"major","file":"scripts/quality/x.sh","summary":"no tests"}]}'`;
    const r = fx.runWith({ QUALITY_REVIEW_CMD: reviewer }, "review", "run");
    expect(r.code, r.out).toBe(1);
    const e = fx.task("FX-1").evidence.at(-1);
    expect(e).toMatchObject({ kind: "review", mode: "fresh_session", verdict: "CHANGES_REQUESTED", open_findings: 1 });
    expect(fx.run("status").out).toMatch(/review\s+FAIL/u);
  });
});

describe("task-level risk findings", () => {
  it("forbidden findings cannot be acknowledged; high-risk ones can", () => {
    const owned = { "apps/web/a.test.ts": "b" };
    const t = (ack: string) => task({ classification: { classes: ["TEST_ONLY"], change_kind: "non_behavioral" }, risk_acknowledgements: [{ finding: ack, reason: "please" }] });
    const forbidden = [{ id: "test_focus_only:apps/web/a.test.ts", rule: "test_focus_only", severity: "forbidden", detail: "" }];
    const high = [{ id: "test_skip_added:apps/web/a.test.ts", rule: "test_skip_added", severity: "high", detail: "" }];
    expect(evaluate(policy, t(forbidden[0].id), { root: REPO_ROOT, owned, findings: forbidden }).findingsProblems[0]).toContain("FORBIDDEN");
    expect(evaluate(policy, t(high[0].id), { root: REPO_ROOT, owned, findings: high }).findingsProblems).toEqual([]);
    expect(evaluate(policy, t("other"), { root: REPO_ROOT, owned, findings: high }).findingsProblems).toHaveLength(1);
  });
});

describe("harness self-test accounting", () => {
  const report = (tests: Array<[string, string]>, files = ["scripts/quality/harness/a.test.ts"]) => ({
    schema: "frontend-debt-vitest/1",
    reason: "passed",
    unhandledErrors: [],
    modules: files.map((file) => ({ file, errors: [], tests: tests.map(([name, state]) => ({ name, state })) }))
  });
  it("skips, failures and missing required files are violations; zero tests is a tool failure", async () => {
    const { summarizeHarnessReport } = await import("./lib/selftest.mjs");
    const req = ["scripts/quality/harness/a.test.ts"];
    expect(summarizeHarnessReport(report([["x", "passed"]]), 0, req).result).toBe("PASS");
    const skipped = summarizeHarnessReport(report([["x", "passed"], ["y", "skipped"]]), 0, req);
    expect(skipped.result).toBe("VIOLATION");
    expect(skipped.accounting.unexpected_skips).toBe(1);
    expect(summarizeHarnessReport(report([["x", "failed"]]), 1, req).result).toBe("VIOLATION");
    expect(summarizeHarnessReport(report([["x", "passed"]]), 0, [...req, "scripts/quality/harness/missing.test.ts"]).problems[0]).toContain("not collected");
    expect(() => summarizeHarnessReport(report([]), 0, req)).toThrow(/zero harness tests/u);
    expect(() => summarizeHarnessReport(report([["x", "failed"]]), 0, req)).toThrow(/inconsistent/u);
    expect(() => summarizeHarnessReport(report([["x", "passed"]]), 2, req)).toThrow(/exited with code 2/u);
  });
});
