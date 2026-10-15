// Adversarial harness self-test: every probe below is an attempt to reach a
// CLOSED / merge-ready state through a weaker process. Each must be caught.
// Probes run against disposable fixture repos or temp dirs; the real working
// tree is never mutated. Numbering follows the harness hardening brief (§32).
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { compareDebt, collectLintDebt, ToolFailure } from "../frontend-debt-lib.mjs";
import { fingerprint, worktreeBlobs } from "./lib/git.mjs";
import { loadPolicy, compilePolicy, requiredGates } from "./lib/policy.mjs";
import { runVitestFile } from "./lib/runners.mjs";
import { ownedBlobs } from "./lib/task.mjs";
import { CALC_GO, CALC_TEST_GO, PATTERNS, REPO_ROOT, addGoTest, makeFixture, type Fixture } from "./fixture";

const CALC = "apps/api-go/internal/calc/calc.go";
// Synthetic external dependency evidence for the PARTIAL/CI acceptance tests.
// Local stopped runtimes are now negative cases, never accepted blockers.
function externalBlocker(fixture: Fixture) {
  const task = fixture.task("FX-1");
  const fp = fingerprint(ownedBlobs(fixture.dir, loadPolicy(fixture.dir), task));
  task.evidence.push({ seq: task.evidence.length + 1, kind: "recovery", id: "external", outcome: "EXHAUSTED", fingerprint: fp, attempts: [{ recipe: "local-account", exit_code: 1, verification_exit: 1 }, { recipe: "existing-account", exit_code: 1, verification_exit: 1 }] });
  fixture.saveTask("FX-1", task);
  return { reproduced: true, error: "account owner credential unavailable", remaining: { kind: "credential_unavailable" }, capability_required: "account owner login", recovery_ids: ["external"], alternatives: [{ id: "with-test-db-docker", attempted: true, result: "external identity dependency remains" }, { id: "existing-test-database-url", attempted: true, result: "same unavailable account" }], workaround_attempted: "both local alternatives", why_not_viable: "requires human account identity" };
}
const CALC_TEST = "apps/api-go/internal/calc/calc_test.go";
const DISCOUNT_TEST = `func TestDiscount(t *testing.T) {
	if got := Discount(200); got != 180 {
		t.Fatalf("discount: got %d want 180", got)
	}
}`;
const DISCOUNT_IMPL = "func Discount(total int) int { if total >= 100 { return total * 9 / 10 }; return total }";

let fx: Fixture;
afterEach(() => fx?.cleanup());

function begin(id: string, classes: string, kind: string, extra: string[] = []) {
  expect(fx.run("begin", id, `probe ${id}`).code).toBe(0);
  expect(fx.run("spec", "--acceptance", "probe").code).toBe(0);
  const r = fx.run("classify", classes, "--kind", kind, ...extra);
  expect(r.code, r.out).toBe(0);
}

/** A legitimately closed DOMAIN_LOGIC task (Case A), committed. */
function legitTask(id = "FX-1") {
  begin(id, "DOMAIN_LOGIC", "modify");
  fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, DISCOUNT_TEST));
  expect(fx.run("red", "--go", "./internal/calc:TestDiscount", "--expect", "discount: got 200 want 180").code).toBe(0);
  fx.write(CALC, CALC_GO.replace("func Discount(total int) int { return total }", DISCOUNT_IMPL));
  expect(fx.run("green").code).toBe(0);
  expect(fx.run("verify").code).toBe(0);
  const close = fx.run("close");
  expect(close.code, close.out).toBe(0);
  return fx.commit(`task ${id}`);
}

/** Forge a CLOSED block for whatever the task currently owns (what a careless/malicious agent could hand-write). */
function forgeClose(id: string, status = "VERIFIED") {
  const t = fx.task(id);
  const changed = fx.git("diff", "--name-only", t.start_head).split("\n").filter(Boolean);
  const untracked = fx.git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean);
  const paths = [...new Set([...changed, ...untracked])].filter((p) => !p.startsWith("tasks/"));
  const files = worktreeBlobs(fx.dir, paths);
  t.closed = { at: "now", head: t.start_head, fingerprint: fingerprint(files), status, gates: {}, files };
  t.state = "CLOSED";
  fx.saveTask(id, t);
  return t;
}

const check = (base: string) => fx.run("check", "--base", base, "--head", "HEAD");

describe("BYPASS-01 behavior change without valid RED", () => {
  it("cannot close; a forged CLOSED record fails the CI check (red MISSING)", () => {
    fx = makeFixture();
    begin("FX-1", "DOMAIN_LOGIC", "modify");
    fx.write(CALC, CALC_GO.replace("func Discount(total int) int { return total }", DISCOUNT_IMPL));
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, DISCOUNT_TEST));
    expect(fx.run("close").code).toBe(1);
    forgeClose("FX-1");
    fx.commit("forged");
    const r = check(fx.base);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/gate red: MISSING/u);
  });
});

describe("BYPASS-02 fake VALID_RED", () => {
  it("a runner/tool failure is recorded as TOOL_FAILURE (exit 2), never as RED", () => {
    fx = makeFixture();
    begin("FX-1", "DOMAIN_LOGIC", "modify");
    const r = fx.run("red", "--go", "./internal/missing:TestNothing", "--expect", "x");
    expect([1, 2]).toContain(r.code);
    expect(r.out).not.toContain("VALID_RED recorded");
    const last = fx.task("FX-1").evidence.at(-1);
    expect(["TOOL_FAILURE", "INVALID_RED"]).toContain(last.outcome);
  });

  it("forged VALID_RED evidence for a test that does not fail on base code is caught by the replay", () => {
    fx = makeFixture();
    begin("FX-1", "DOMAIN_LOGIC", "modify");
    // Vacuous test: passes before and after the change.
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, `func TestDiscount(t *testing.T) { if Discount(50) != 50 { t.Fatalf("discount: got 200 want 180") } }`));
    fx.write(CALC, CALC_GO.replace("func Discount(total int) int { return total }", DISCOUNT_IMPL));
    expect(fx.run("green", "--task", "FX-1").code).toBe(1); // no targets yet
    const t = fx.task("FX-1");
    t.red_targets = [{ runner: "go", package: "./internal/calc", test: "TestDiscount", expect: "discount: got 200 want 180" }];
    t.evidence.push({ seq: 1, kind: "red", outcome: "VALID_RED", production_at_base: true, targets: [{ id: "go:./internal/calc:TestDiscount", valid: true }], expects: { "go:./internal/calc:TestDiscount": "discount: got 200 want 180" } });
    fx.saveTask("FX-1", t);
    expect(fx.run("green").code).toBe(0);
    expect(fx.run("verify").code).toBe(0);
    expect(fx.run("close").code).toBe(0); // local evidence was forged...
    fx.commit("forged red");
    const replay = fx.run("replay", "--base", fx.base, "--head", "HEAD");
    expect(replay.code).toBe(1); // ...but CI re-executes it
    expect(replay.out).toContain("test passes before the change");
  });
});

describe("BYPASS-03 unexpected skipped test", () => {
  it("fails the Go suite gate with real go test output", () => {
    fx = makeFixture();
    begin("FX-1", "TEST_ONLY", "non_behavioral");
    fx.write(CALC_TEST, CALC_TEST_GO.replace("if got := Add(2, 3)", `${PATTERNS.goSkip}"later")\n\tif got := Add(2, 3)`));
    const r = fx.run("verify");
    expect(r.code).toBe(1);
    expect(fx.task("FX-1").evidence.at(-1)).toMatchObject({ result: "VIOLATION", accounting: { unexpected_skips: 1 } });
  });

  it("real go test JSON: an unlisted skip, a stale allowed skip and an empty report are rejected", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "go-audit-"));
    try {
      mkdirSync(path.join(dir, "internal/x"), { recursive: true });
      writeFileSync(path.join(dir, "go.mod"), "module github.com/kotobawork/nihongo-bjt/api-go\n\ngo 1.21\n");
      writeFileSync(path.join(dir, "internal/x/x_test.go"), `package x\nimport "testing"\nfunc TestA(t *testing.T) {}\nfunc TestB(t *testing.T) { ${PATTERNS.goSkip}"no db") }\n`);
      const go = spawnSync("go", ["test", "-json", "-count=1", "./..."], { cwd: dir, encoding: "utf8" });
      writeFileSync(path.join(dir, "report.json"), go.stdout);
      const audit = (baseline: object, report = "report.json") => {
        writeFileSync(path.join(dir, "baseline.json"), JSON.stringify(baseline));
        return spawnSync("node", [path.join(REPO_ROOT, "scripts/quality/check-go-test-report.mjs"), path.join(dir, report), String(go.status), "--baseline", path.join(dir, "baseline.json")], { encoding: "utf8", env: { ...process.env, GITHUB_ACTIONS: "", QUALITY_SUMMARY_DIR: "" } });
      };
      expect(audit({ min_passed_tests: 1, allowed_skips: {} }).status).toBe(1);
      expect(audit({ min_passed_tests: 1, allowed_skips: { "internal/x::TestB": "r" } }).status).toBe(0);
      expect(audit({ min_passed_tests: 1, allowed_skips: { "internal/x::TestB": "r", "internal/x::TestGone": "r" } }).status).toBe(1);
      expect(audit({ min_passed_tests: 5, allowed_skips: { "internal/x::TestB": "r" } }).status).toBe(1);
      writeFileSync(path.join(dir, "empty.json"), "");
      expect(audit({ min_passed_tests: 0, allowed_skips: {} }, "empty.json").status).toBe(2);
      expect(audit({ min_passed_tests: 0, allowed_skips: {} }, "missing.json").status).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("BYPASS-04/05 debt substitution", () => {
  const baseline = { eslint: { min_linted_files: 1, violations: { "a.ts": { "error:no-any": 1 } } }, vitest: { min_test_files: 1, min_tests: 2, known_failures: ["a.test.ts > old"], known_skipped: [] } };
  it("04: same total lint debt in a different file is NEW debt", () => {
    const v = compareDebt(baseline, { lint: { lintedFiles: 1, violations: { "b.ts": { "error:no-any": 1 } } }, tests: { testFiles: 1, tests: 2, failures: ["a.test.ts > old"], skipped: [] } });
    expect(v.newDebt.map((d: any) => d.id)).toEqual(["b.ts [error:no-any]"]);
  });
  it("05: a different failing test replacing the known one is NEW debt", () => {
    const v = compareDebt(baseline, { lint: { lintedFiles: 1, violations: { "a.ts": { "error:no-any": 1 } } }, tests: { testFiles: 1, tests: 2, failures: ["a.test.ts > new"], skipped: [] } });
    expect(v.newDebt.map((d: any) => d.id)).toEqual(["a.test.ts > new"]);
  });
});

describe("BYPASS-06..10 weakening the suite", () => {
  function closedWith(mutate: () => void, kind = "TEST_ONLY") {
    fx = makeFixture();
    begin("FX-1", kind, "non_behavioral");
    mutate();
    fx.run("verify"); // outcome irrelevant: the record below is forged anyway
    forgeClose("FX-1");
    fx.commit("weaken");
    return check(fx.base);
  }

  it("06: lowering the Go pass floor / adding an allowed skip needs acknowledgement + review", () => {
    const r = closedWith(() => fx.write("scripts/quality/go-test-skips-baseline.json", JSON.stringify({ note: "x", min_passed_tests: 0, allowed_skips: { "internal/calc::TestAdd": "meh" } })), "CI_QUALITY_SYSTEM");
    expect(r.code).toBe(1);
    expect(r.out).toContain("baseline_expanded:scripts/quality/go-test-skips-baseline.json:min_passed_tests lowered");
    expect(r.out).toContain("baseline_expanded:scripts/quality/go-test-skips-baseline.json:allowed_skip_added internal/calc::TestAdd");
    expect(r.out).toMatch(/gate review: MISSING/u);
  });

  it("07: adding a skip is an unacknowledged high-risk change", () => {
    const r = closedWith(() => fx.write("apps/web/a.test.ts", `import { it } from "vitest";\n${PATTERNS.skip}"x", () => {});\n`));
    expect(r.code).toBe(1);
    expect(r.out).toContain("unacknowledged high-risk change test_skip_added:apps/web/a.test.ts");
  });

  it("08: a focused test is FORBIDDEN even when acknowledged", () => {
    fx = makeFixture();
    begin("FX-1", "TEST_ONLY", "non_behavioral");
    fx.write("apps/web/a.test.ts", `import { it } from "vitest";\n${PATTERNS.only}"x", () => {});\n`);
    const t = fx.task("FX-1");
    t.risk_acknowledgements = [{ finding: "test_focus_only:apps/web/a.test.ts", reason: "please" }];
    fx.saveTask("FX-1", t);
    forgeClose("FX-1");
    fx.commit("only");
    const r = check(fx.base);
    expect(r.code).toBe(1);
    expect(r.out).toContain("FORBIDDEN test_focus_only:apps/web/a.test.ts");
  });

  it("09: deleting a test file is an unacknowledged high-risk change", () => {
    const r = closedWith(() => fx.remove(CALC_TEST));
    expect(r.code).toBe(1);
    expect(r.out).toContain(`test_file_deleted:${CALC_TEST}`);
  });

  it("10: an or-true in CI is FORBIDDEN and an invariant violation; in a quality script it needs acknowledgement", () => {
    const r = closedWith(() => {
      const ci = fx.read(".github/workflows/ci.yml").replace("run: bash scripts/quality/verify-go.sh", `run: bash scripts/quality/verify-go.sh ${PATTERNS.orTrue}`);
      fx.write(".github/workflows/ci.yml", ci);
      fx.write("scripts/quality/extra.sh", `#!/usr/bin/env bash\nset -euo pipefail\nfalse ${PATTERNS.orTrue}\n`);
    }, "CI_QUALITY_SYSTEM");
    expect(r.code).toBe(1);
    expect(r.out).toContain("FORBIDDEN ci_swallowed_failure:.github/workflows/ci.yml");
    expect(r.out).toContain("[invariant WF_NO_SWALLOWED_FAILURE]");
    expect(r.out).toContain("unacknowledged high-risk change quality_swallowed_failure:scripts/quality/extra.sh");
  });

  it("assertions removed from a test file are flagged", () => {
    const r = closedWith(() => fx.write(CALC_TEST, CALC_TEST_GO.replace('\t\tt.Fatalf("add: got %d want 5", got)\n', "\t\t_ = got\n")));
    expect(r.code).toBe(1);
    expect(r.out).toContain(`assertions_reduced:${CALC_TEST}`);
  });
});

describe("BYPASS-11 CI continue-on-error", () => {
  it("is FORBIDDEN in the diff and an invariant violation", () => {
    fx = makeFixture();
    begin("FX-1", "CI_QUALITY_SYSTEM", "non_behavioral");
    fx.write(".github/workflows/ci.yml", fx.read(".github/workflows/ci.yml").replace("timeout-minutes: 30", `timeout-minutes: 30\n    ${PATTERNS.continueOnError}`));
    forgeClose("FX-1");
    fx.commit("coe");
    const r = check(fx.base);
    expect(r.code).toBe(1);
    expect(r.out).toContain("FORBIDDEN ci_continue_on_error:.github/workflows/ci.yml");
    expect(r.out).toContain("[invariant WF_NO_CONTINUE_ON_ERROR]");
  });
});

describe("BYPASS-12 missing required evidence", () => {
  it("close lists every missing gate; a CI_QUALITY_SYSTEM task without the adversarial suite cannot close", () => {
    fx = makeFixture();
    begin("FX-1", "CI_QUALITY_SYSTEM", "add", ["--red-exception", "config_only", "--reason", "x"]);
    fx.write("scripts/quality/x.sh", "#!/usr/bin/env bash\nset -euo pipefail\n");
    const r = fx.run("close");
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/suite_harness\s+MISSING/u);
    expect(r.out).toMatch(/review\s+MISSING/u);
  });
});

describe("BYPASS-13 wrong verified SHA / stale evidence", () => {
  it("evidence from an earlier state is STALE locally", () => {
    fx = makeFixture();
    begin("FX-1", "TEST_ONLY", "non_behavioral");
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, "func TestMore(t *testing.T) { if Add(1, 1) != 2 { t.Fatal(\"x\") } }"));
    expect(fx.run("verify").code).toBe(0);
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, "func TestMore(t *testing.T) { if Add(1, 2) != 3 { t.Fatal(\"x\") } }"));
    const r = fx.run("close");
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/suite_go\s+STALE/u);
  });

  it("a file changed after close is STALE in the CI check; a hand-edited fingerprint is rejected", () => {
    fx = makeFixture();
    const head = legitTask();
    fx.write(CALC, fx.read(CALC).replace("return a + b", "return b + a"));
    fx.commit("sneaky follow-up");
    const r = check(fx.base);
    expect(r.code).toBe(1);
    expect(r.out).toContain(`STALE: 1 file(s) changed after the task was verified/closed: ${CALC}`);

    fx.git("reset", "-q", "--hard", head);
    const t = fx.task("FX-1");
    t.closed.fingerprint = "0".repeat(64);
    fx.saveTask("FX-1", t);
    fx.commit("tamper");
    expect(check(fx.base).out).toContain("closed.fingerprint does not match closed.files");
  });

  it("changes not owned by any closed task are UNOWNED", () => {
    fx = makeFixture();
    legitTask();
    fx.write("apps/api-go/internal/calc/extra.go", "package calc\n\nfunc Extra() int { return 1 }\n");
    fx.commit("drive-by");
    const r = check(fx.base);
    expect(r.code).toBe(1);
    expect(r.out).toContain("UNOWNED: 1 changed file(s)");
  });

  it("a realtime change hidden under DOMAIN_LOGIC is misclassified", () => {
    fx = makeFixture();
    begin("FX-1", "DOMAIN_LOGIC", "modify");
    fx.write("apps/api-go/internal/realtime/hub.go", "package realtime\n");
    const r = fx.run("status");
    expect(r.out).toContain("misclassified: apps/api-go/internal/realtime/hub.go is realtime and requires one of [REALTIME]");
    expect(fx.run("close").code).toBe(1);
  });
});

describe("BYPASS-14 closing with an incomplete mandatory gate", () => {
  it("BLOCKED yields PARTIAL; claiming VERIFIED over a BLOCKED gate is rejected by CI", () => {
    fx = makeFixture();
    begin("FX-1", "TEST_ONLY", "non_behavioral");
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, "func TestMore(t *testing.T) { if Add(1, 1) != 2 { t.Fatal(\"x\") } }"));
    const protocol = externalBlocker(fx);
    const file = path.join(fx.dir, "..", `blocker-${path.basename(fx.dir)}.json`);
    writeFileSync(file, JSON.stringify(protocol));
    expect(fx.run("block", "suite_go", "--protocol", file).code).toBe(0);
    const close = fx.run("close");
    expect(close.code, close.out).toBe(0);
    expect(close.out).toContain("CLOSED as PARTIAL");
    const t = fx.task("FX-1");
    t.closed.status = "VERIFIED";
    fx.saveTask("FX-1", t);
    fx.commit("claim verified");
    const r = check(fx.base);
    expect(r.code).toBe(1);
    expect(r.out).toContain("closed.status VERIFIED but evidence supports PARTIAL");
    rmSync(file, { force: true });
  });

  it("an open (not CLOSED) task is not merge-ready", () => {
    fx = makeFixture();
    begin("FX-1", "TEST_ONLY", "non_behavioral");
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, "func TestMore(t *testing.T) {}"));
    fx.commit("wip");
    expect(check(fx.base).out).toContain("task is not CLOSED");
  });
});

describe("BYPASS-15 false BLOCKED", () => {
  it("a blocker that ignores the known in-process alternative is rejected; non-blockable gates cannot be blocked", () => {
    fx = makeFixture();
    begin("FX-1", "DOMAIN_LOGIC", "modify");
    const file = path.join(fx.dir, "..", `blocker2-${path.basename(fx.dir)}.json`);
    writeFileSync(file, JSON.stringify({ reproduced: true, error: "port 5432 in use", alternatives: [{ id: "existing-test-database-url", attempted: false, result: "n/a" }], workaround_attempted: "none", why_not_viable: "busy" }));
    const r = fx.run("block", "suite_go", "--protocol", file);
    expect(r.code).toBe(1);
    expect(r.out).toContain('known alternative "with-test-db-docker" was not addressed');
    expect(r.out).toContain("at least one alternative must actually be attempted");
    const red = fx.run("block", "red", "--protocol", file);
    expect(red.code).toBe(1);
    expect(red.out).toContain("gate red cannot be BLOCKED");
    rmSync(file, { force: true });
  });
});

describe("BYPASS-16 quality-script parser / tool failure", () => {
  it("a broken ESLint configuration (real eslint, exit 2) is a tool failure, not zero debt", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "eslint-broken-"));
    try {
      writeFileSync(path.join(dir, "eslint.config.mjs"), "throw new Error('broken config');\n");
      writeFileSync(path.join(dir, "a.js"), "export const a = 1;\n");
      const r = spawnSync(path.join(REPO_ROOT, "node_modules/.bin/eslint"), ["--config", path.join(dir, "eslint.config.mjs"), "--format", "json", path.join(dir, "a.js")], { encoding: "utf8", cwd: dir });
      expect(r.status).toBe(2);
      expect(() => collectLintDebt({ report: [], exitCode: r.status, repoRoot: dir })).toThrow(ToolFailure);
      expect(() => collectLintDebt({ report: { not: "an array" }, exitCode: 0, repoRoot: dir })).toThrow(ToolFailure);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a broken Vitest configuration (real vitest) is a TOOL_FAILURE for the runner", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "vitest-broken-"));
    try {
      const config = path.join(dir, "vitest.config.mjs");
      writeFileSync(config, "throw new Error('broken vitest config');\n");
      const raw = JSON.parse(readFileSync(path.join(REPO_ROOT, "docs/engineering/engineering-policy.json"), "utf8"));
      raw.runners.vitest.default_config = config;
      raw.runners.vitest.configs = [];
      const policy = compilePolicy(raw);
      expect(() => runVitestFile(REPO_ROOT, policy, "scripts/quality/frontend-debt-lib.test.ts", [{ runner: "vitest", file: "scripts/quality/frontend-debt-lib.test.ts", test: "x" }])).toThrow(/TOOL|vitest/u);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("go test output that is not JSON is a tool failure (exit 2)", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "go-garbage-"));
    try {
      writeFileSync(path.join(dir, "r.json"), "ok  \tgithub.com/x\t0.1s\n");
      const r = spawnSync("node", [path.join(REPO_ROOT, "scripts/quality/check-go-test-report.mjs"), path.join(dir, "r.json"), "0"], { encoding: "utf8" });
      expect(r.status).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("an invalid policy file is a tool failure", () => {
    expect(() => compilePolicy({ schema: "nope" })).toThrow(/invalid/u);
    expect(loadPolicy(REPO_ROOT).raw.schema).toBe("nihongo-engineering-policy/1");
  });
});

describe("Deployment SHA gate (verify-ci-passed.sh with a stubbed gh)", () => {
  const sha = "a".repeat(40);
  function runGate(ghOutput: string, arg = sha) {
    const dir = mkdtempSync(path.join(os.tmpdir(), "gh-stub-"));
    try {
      writeFileSync(path.join(dir, "gh"), `#!/usr/bin/env bash\necho "$*" > "${dir}/args"\nprintf '%s\\n' '${ghOutput}'\n`);
      chmodSync(path.join(dir, "gh"), 0o755);
      const r = spawnSync("bash", [path.join(REPO_ROOT, "scripts/quality/verify-ci-passed.sh"), arg], {
        encoding: "utf8",
        env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, GITHUB_REPOSITORY: "o/r" }
      });
      let args = "";
      try {
        args = readFileSync(path.join(dir, "args"), "utf8");
      } catch {
        args = "";
      }
      return { code: r.status, args };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  it("deploys only when CI succeeded for exactly that SHA on a push to main", () => {
    const ok = runGate("1");
    expect(ok.code).toBe(0);
    expect(ok.args).toContain(`head_sha=${sha}`);
    expect(ok.args).toContain("event=push");
    expect(ok.args).toContain("branch=main");
    expect(ok.args).toContain("status=success");
    expect(runGate("0").code).toBe(1);
    expect(runGate("garbage").code).toBe(2);
    expect(runGate("1", "main").code).toBe(2);
    expect(runGate("1", "abc123").code).toBe(2);
  });
});

// Findings from the independent review of HARNESS-001 (each was a real hole).
describe("REVIEW-B1 builder-attested review", () => {
  it("a fresh_session review needs the reviewer's own output; the verdict is parsed from it", () => {
    fx = makeFixture();
    begin("FX-1", "CI_QUALITY_SYSTEM", "add", ["--red-exception", "config_only", "--reason", "x"]);
    fx.write("scripts/quality/x.sh", "#!/usr/bin/env bash\nset -euo pipefail\n");
    const noOutput = fx.run("review", "record", "--reviewer", "me", "--mode", "fresh_session", "--verdict", "APPROVE");
    expect(noOutput.code).toBe(1);
    expect(noOutput.out).toContain("fresh_session reviews need --output");
    const out = path.join(fx.dir, "..", `review-${path.basename(fx.dir)}.txt`);
    writeFileSync(out, 'looks risky\n{"verdict":"CHANGES_REQUESTED","open_findings":1}\n');
    const mismatch = fx.run("review", "record", "--reviewer", "s", "--mode", "fresh_session", "--verdict", "APPROVE", "--output", out);
    expect(mismatch.code).toBe(1);
    expect(mismatch.out).toContain("does not match the reviewer output");
    expect(fx.run("review", "record", "--reviewer", "s", "--mode", "self", "--verdict", "APPROVE").code).toBe(1);
    rmSync(out, { force: true });
  });

  it("review-only exceptions are narrowed to the change kinds they make sense for", () => {
    const policy = loadPolicy(REPO_ROOT);
    expect(policy.raw.red_exceptions.not_reproducible.allowed_kinds).toEqual(["bugfix"]);
    fx = makeFixture();
    expect(fx.run("begin", "FX-1", "t").code).toBe(0);
    expect(fx.run("spec", "--acceptance", "a").code).toBe(0);
    const r = fx.run("classify", "DOMAIN_LOGIC", "--kind", "add", "--red-exception", "not_reproducible", "--reason", "trust me");
    expect(r.code).toBe(1);
    expect(r.out).toContain("only allowed for change_kind bugfix");
  });

  it("the CI check lists attested (not recomputable) gates", () => {
    fx = makeFixture();
    begin("FX-1", "CI_QUALITY_SYSTEM", "add", ["--red-exception", "config_only", "--reason", "x"]);
    fx.write("scripts/quality/x.sh", "#!/usr/bin/env bash\nset -euo pipefail\n");
    expect(fx.run("verify").code).toBe(0);
    expect(fx.run("review", "record", "--reviewer", "a human", "--verdict", "APPROVE").code).toBe(0);
    expect(fx.run("close").code).toBe(0);
    fx.commit("q");
    const r = check(fx.base);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain("ATTESTED (not recomputable by CI): review");
  });
});

describe("REVIEW-B2 sensitivity mutation must break production code", () => {
  it("mutating the test itself (or escaping the tree) is rejected locally and in CI", () => {
    fx = makeFixture();
    begin("FX-1", "DOMAIN_LOGIC", "characterization");
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, `func TestVacuous(t *testing.T) { if 1 != 1 { t.Fatal("never") } }`));
    const self = fx.run("sensitivity", "--file", CALC_TEST, "--find", "1 != 1", "--replace", "1 == 1", "--go", "./internal/calc:TestVacuous", "--expect", "never");
    expect(self.code).toBe(1);
    expect(self.out).toContain("must break production code");
    const escape = fx.run("sensitivity", "--file", "../outside.go", "--find", "a", "--replace", "b", "--go", "./internal/calc:TestVacuous", "--expect", "never");
    expect(escape.code).toBe(1);
    expect(escape.out).toContain("inside the repository");
    // Forged evidence for a test-file mutation is INVALID in the CI check.
    const t = fx.task("FX-1");
    t.sensitivity = { mutation: { file: CALC_TEST, find: "1 != 1", replace: "1 == 1" }, targets: [{ runner: "go", package: "./internal/calc", test: "TestVacuous" }] };
    t.evidence.push({ seq: 9, kind: "sensitivity", outcome: "SENSITIVE", mutation: t.sensitivity.mutation, targets: [], fingerprint: "x" });
    fx.saveTask("FX-1", t);
    forgeClose("FX-1");
    fx.commit("forged");
    expect(check(fx.base).out).toContain("gate sensitivity: INVALID");
  });
});

describe("REVIEW-M3 unknown diff base in CI", () => {
  it("fails closed (TOOL_FAILURE) instead of checking only the last commit", () => {
    fx = makeFixture();
    const zeros = fx.run("check", "--ci", "--base", "0".repeat(40), "--head", "HEAD");
    expect(zeros.code).toBe(2);
    expect(zeros.out).toContain("cannot determine what changed");
    expect(fx.run("check", "--ci", "--base", "deadbeef".repeat(5), "--head", "HEAD").code).toBe(2);
  });
});

describe("REVIEW-M4 dependent tasks in one range", () => {
  it("each task's RED is replayed against its own start, not the range base", () => {
    fx = makeFixture();
    begin("FX-1", "DOMAIN_LOGIC", "add", ["--red-exception", "new_component", "--reason", "new function"]);
    fx.write(CALC, `${CALC_GO}\n// Tax returns the tax.\nfunc Tax(total int) int { return total / 10 }\n`);
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, `func TestTax(t *testing.T) { if got := Tax(200); got != 20 { t.Fatalf("tax: got %d", got) } }`));
    expect(fx.run("sensitivity", "--file", CALC, "--find", "return total / 10", "--replace", "return total / 5", "--go", "./internal/calc:TestTax", "--expect", "tax: got").code).toBe(0);
    expect(fx.run("green").code).toBe(0);
    expect(fx.run("verify").code).toBe(0);
    expect(fx.run("review", "record", "--reviewer", "h", "--verdict", "APPROVE").code).toBe(0);
    expect(fx.run("close").code).toBe(0);
    fx.commit("FX-1 adds Tax");

    begin("FX-2", "DOMAIN_LOGIC", "modify");
    fx.write(CALC_TEST, addGoTest(fx.read(CALC_TEST), `func TestTaxRounds(t *testing.T) { if got := Tax(205); got != 21 { t.Fatalf("tax rounding: got %d want 21", got) } }`));
    expect(fx.run("red", "--go", "./internal/calc:TestTaxRounds", "--expect", "tax rounding: got 20 want 21").code).toBe(0);
    fx.write(CALC, fx.read(CALC).replace("return total / 10", "return (total + 5) / 10"));
    expect(fx.run("green").code).toBe(0);
    expect(fx.run("verify").code).toBe(0);
    expect(fx.run("close").code).toBe(0);
    const head = fx.commit("FX-2 rounds Tax");

    const replay = fx.run("replay", "--base", fx.base, "--head", head);
    expect(replay.code, replay.out).toBe(0);
    // FX-1 is replayed at the commit that closed it, not skipped as superseded.
    expect(replay.out).toContain("FX-1 sensitivity: 1 target(s) fail under the mutation");
    expect(replay.out).toContain("FX-2 red: 1 target(s) fail against base production code");
    expect(replay.out).not.toContain("superseded");
  });
});

describe("REVIEW-M5 evidence CI can recompute is recomputed", () => {
  it("a forged clean deletion scan fails: CI re-runs the stale-reference scan", () => {
    fx = makeFixture();
    begin("FX-1", "FUNCTION_DELETION", "delete");
    fx.write(CALC, CALC_GO.replace("// LegacyHandler serves the old endpoint.\nfunc LegacyHandler() int { return registry[\"legacy\"] }\n\n", ""));
    const t = fx.task("FX-1");
    t.deletion = { symbols: ["LegacyHandler"], consumer_audit: "checked", allowed_references: [] };
    t.evidence.push({ seq: 9, kind: "deletion_scan", symbols: ["LegacyHandler"], hits: [], result: "PASS", fingerprint: "x" });
    fx.saveTask("FX-1", t);
    forgeClose("FX-1");
    fx.commit("forged deletion");
    expect(check(fx.base).out).toContain("deletion_audit recomputed: 1 stale reference(s), e.g. docs/README.md");
  });

  it("a PARTIAL task needs explicit acceptance to merge", () => {
    fx = makeFixture();
    begin("FX-1", "TEST_ONLY", "non_behavioral");
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, "func TestMore(t *testing.T) { if Add(1, 1) != 2 { t.Fatal(\"x\") } }"));
    const file = path.join(fx.dir, "..", `blocker3-${path.basename(fx.dir)}.json`);
    writeFileSync(file, JSON.stringify(externalBlocker(fx)));
    expect(fx.run("block", "suite_go", "--protocol", file).code).toBe(0);
    rmSync(file, { force: true });
    expect(fx.run("close").code).toBe(0);
    fx.commit("partial");
    const refused = check(fx.base);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain("merging a PARTIAL task needs explicit acceptance");
    const accepted = fx.runWith({ QUALITY_ACCEPT_PARTIAL: "true" }, "check", "--base", fx.base, "--head", "HEAD");
    expect(accepted.code, accepted.out).toBe(0);
    expect(accepted.out).toContain("ATTESTED (not recomputable by CI): suite_go");
  });
});

describe("REVIEW-minor findings", () => {
  it("agent instruction files are quality-system paths, not exempt docs; migrations have a schema_only path", () => {
    const policy = loadPolicy(REPO_ROOT);
    const kind = (p: string) => policy.pathRules.find((r: { regexps: RegExp[] }) => r.regexps.some((re) => re.test(p))).kind;
    expect(kind(".claude/skills/flutter-add-widget-test/SKILL.md")).toBe("quality_system");
    expect(kind(".cursor/rules/03-testing-security.mdc")).toBe("quality_system");
    expect(policy.raw.red_exceptions.schema_only.allowed_classes).toEqual(["DATABASE"]);
  });
});

// Findings from the re-review of HARNESS-001.
describe("RE-REVIEW-1 schema_only covers migrations only", () => {
  it("rejects schema_only when the task owns revertible code", async () => {
    const { requiredGates } = await import("./lib/policy.mjs");
    const policy = loadPolicy(REPO_ROOT);
    const t = { classification: { classes: ["DATABASE"], change_kind: "modify" }, red_exception: { category: "schema_only", reason: "migration" } };
    expect(requiredGates(policy, t, ["apps/api-go/internal/postgres/migrations/010_x.sql"]).errors).toEqual([]);
    expect(requiredGates(policy, t, ["apps/api-go/internal/career/service.go"]).errors.join(" ")).toContain("cannot cover revertible code");
  });
});

describe("RE-REVIEW-3 crash injection is not sensitivity", () => {
  it("rejects panic/throw mutations and requires the declared assertion text", async () => {
    const { validateMutation } = await import("./lib/task.mjs");
    const policy = loadPolicy(REPO_ROOT);
    expect(validateMutation(policy, { file: "apps/api-go/internal/career/store.go", find: "return x", replace: 'panic("m")' })[0]).toContain("not inject a crash");
    expect(validateMutation(policy, { file: "apps/web/lib/a.ts", find: "return x", replace: "throw new Error('m')" })[0]).toContain("not inject a crash");
    expect(validateMutation(policy, { file: "apps/api-go/internal/career/store.go", find: "a + b", replace: "a - b" })).toEqual([]);

    fx = makeFixture();
    begin("FX-1", "DOMAIN_LOGIC", "characterization");
    // Assertion-free test: a behavioral mutation (not a crash) leaves it passing, so it is INSENSITIVE.
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, `func TestCallsOnly(t *testing.T) { _ = Discount(10) }`));
    const r = fx.run("sensitivity", "--file", CALC, "--find", "func Discount(total int) int { return total }", "--replace", "func Discount(total int) int { return total + 1 }", "--go", "./internal/calc:TestCallsOnly", "--expect", "discount");
    expect(r.code).toBe(1);
    expect(r.out).toContain("INSENSITIVE");
    expect(fx.run("sensitivity", "--go", "./internal/calc:TestCallsOnly").out).toContain("INSENSITIVE");
  });
});

describe("RE-REVIEW-2 replay for a PR that is behind main", () => {
  it("replays dependent tasks against their own start, not the newer main tip", () => {
    fx = makeFixture();
    fx.git("checkout", "-q", "-b", "feature");
    begin("FX-1", "DOMAIN_LOGIC", "add", ["--red-exception", "new_component", "--reason", "new function"]);
    fx.write(CALC, `${CALC_GO}\n// Tax returns the tax.\nfunc Tax(total int) int { return total / 10 }\n`);
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, `func TestTax(t *testing.T) { if got := Tax(200); got != 20 { t.Fatalf("tax: got %d", got) } }`));
    expect(fx.run("sensitivity", "--file", CALC, "--find", "return total / 10", "--replace", "return total / 5", "--go", "./internal/calc:TestTax", "--expect", "tax: got").code).toBe(0);
    expect(fx.run("green").code).toBe(0);
    expect(fx.run("verify").code).toBe(0);
    expect(fx.run("review", "record", "--reviewer", "h", "--verdict", "APPROVE").code).toBe(0);
    expect(fx.run("close").code).toBe(0);
    fx.commit("FX-1");
    begin("FX-2", "DOMAIN_LOGIC", "modify");
    fx.write(CALC_TEST, addGoTest(fx.read(CALC_TEST), `func TestTaxRounds(t *testing.T) { if got := Tax(205); got != 21 { t.Fatalf("tax rounding: got %d want 21", got) } }`));
    expect(fx.run("red", "--go", "./internal/calc:TestTaxRounds", "--expect", "tax rounding: got 20 want 21").code).toBe(0);
    fx.write(CALC, fx.read(CALC).replace("return total / 10", "return (total + 5) / 10"));
    expect(fx.run("green").code).toBe(0);
    expect(fx.run("verify").code).toBe(0);
    expect(fx.run("close").code).toBe(0);
    fx.commit("FX-2");

    // main moves on (unrelated), then the PR is merged with a merge commit.
    fx.git("checkout", "-q", "main");
    fx.write("docs/changelog.md", "# Changelog\n");
    const mainTip = fx.commit("unrelated main change");
    fx.git("merge", "-q", "--no-ff", "-m", "merge feature", "feature");
    const replay = fx.run("replay", "--base", mainTip, "--head", "HEAD");
    expect(replay.code, replay.out).toBe(0);
    expect(replay.out).toContain("FX-2 red: 1 target(s) fail against base production code");
    expect(fx.run("check", "--base", mainTip, "--head", "HEAD").code).toBe(0);
  });
});

describe("INDEPENDENT-REVIEW HARNESS-001 enforcement gaps", () => {
  it.each(["title update", "squash"])("partial supersession preserves invalid RED rejection after %s", (mode) => {
    fx = makeFixture();
    const y = "apps/api-go/internal/calc/value.go";
    fx.write(y, "package calc\nfunc Value() int { return 1 }\n");
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, "func TestY(t *testing.T) { _ = Value() }"));
    const base = fx.commit("base Y and assertion-free TestY");

    begin("FX-1", "DOMAIN_LOGIC", "modify");
    fx.write(CALC, CALC_GO.replace("func Discount(total int) int { return total }", DISCOUNT_IMPL));
    fx.write(y, "package calc\nfunc Value() int { return 2 }\n");
    // Forged RED must be caught by replay: TestY passes on both base and final code.
    const a = fx.task("FX-1");
    const id = "go:./internal/calc:TestY";
    a.red_targets = [{ runner: "go", package: "./internal/calc", test: "TestY", expect: "value assertion" }];
    a.evidence.push({ seq: 1, kind: "red", outcome: "VALID_RED", production_at_base: true, targets: [{ id, valid: true }], expects: { [id]: "value assertion" } });
    fx.saveTask("FX-1", a);
    expect(fx.run("green").code).toBe(0);
    expect(fx.run("verify").code).toBe(0);
    expect(fx.run("close").code).toBe(0);
    fx.commit("A closes X and Y");

    begin("FX-2", "DOMAIN_LOGIC", "refactor");
    fx.write(CALC, fx.read(CALC).replace("return a + b", "return b + a"));
    expect(fx.run("verify").code).toBe(0);
    expect(fx.run("review", "record", "--reviewer", "fixture human", "--verdict", "APPROVE").code).toBe(0);
    expect(fx.run("close").code).toBe(0);
    fx.commit("B closes only X");
    expect(Object.keys(fx.task("FX-1").closed.files).sort()).toEqual([CALC, y].sort());
    expect(Object.keys(fx.task("FX-2").closed.files)).toEqual([CALC]);

    const before = fx.run("replay", "--base", base, "--head", "HEAD");
    expect(before.code, before.out).toBe(1);
    expect(before.out).toContain("TestY: PASS");
    if (mode === "title update") {
      const record = fx.task("FX-1");
      record.title += " (note added)";
      fx.saveTask("FX-1", record);
    } else fx.git("reset", "--soft", base);
    fx.commit(mode);

    const replay = fx.run("replay", "--base", base, "--head", "HEAD");
    expect(replay.code, replay.out).toBe(1);
    expect(replay.out).toContain("FX-1");
    if (mode === "title update") expect(replay.out).toContain("TestY");
  });

  it("final GREEN rejects a missing target when its production file is retained", () => {
    fx = makeFixture();
    legitTask();
    begin("FX-2", "TEST_ONLY", "non_behavioral");
    fx.write(CALC_TEST, fx.read(CALC_TEST).replace("func TestDiscount(", "func TestDiscountRenamed("));
    expect(fx.run("verify").code).toBe(0);
    expect(fx.run("close").code).toBe(0);
    fx.commit("B renames the passing test, retaining A production code");
    expect(worktreeBlobs(fx.dir, [CALC])[CALC]).toBe(fx.task("FX-1").closed.files[CALC]);
    const replay = fx.run("replay", "--base", fx.base, "--head", "HEAD");
    expect(replay.code, replay.out).toBe(1);
    expect(replay.out).toContain("TestDiscount");
  });

  it("final replay detects a sensitivity assertion replaced with a constant", () => {
    fx = makeFixture();
    begin("FX-1", "DOMAIN_LOGIC", "characterization");
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, `func TestAddNegative(t *testing.T) { if got := Add(-2, -3); got != -5 { t.Fatalf("add negative: got %d", got) } }`));
    expect(fx.run("sensitivity", "--file", CALC, "--find", "return a + b", "--replace", "return a - b", "--go", "./internal/calc:TestAddNegative", "--expect", "add negative: got").code).toBe(0);
    expect(fx.run("green").code).toBe(0);
    expect(fx.run("verify").code).toBe(0);
    expect(fx.run("close").code).toBe(0);
    fx.commit("A proves sensitivity");

    begin("FX-2", "TEST_ONLY", "non_behavioral");
    fx.write(CALC_TEST, fx.read(CALC_TEST).replace("got := Add(-2, -3)", "got := -5"));
    // Same assertion count; ordinary suites pass, but the final test lost sensitivity.
    expect(fx.run("verify").code).toBe(0);
    expect(fx.run("close").code).toBe(0);
    fx.commit("B replaces the production call with a constant");
    const replay = fx.run("replay", "--base", fx.base, "--head", "HEAD");
    expect(replay.code, replay.out).toBe(1);
    expect(replay.out).toContain("TestAddNegative");
  });

  it("rejects index-out-of-range sensitivity from an assertion-free test", () => {
    fx = makeFixture();
    begin("FX-1", "DOMAIN_LOGIC", "characterization");
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, "func TestCallsOnly(t *testing.T) { _ = Discount(10) }"));
    const r = fx.run("sensitivity", "--file", CALC, "--find", "func Discount(total int) int { return total }", "--replace", "func Discount(total int) int { return []int{}[total] }", "--go", "./internal/calc:TestCallsOnly", "--expect", "index out of range");
    expect(fx.read(CALC)).toBe(CALC_GO);
    expect(r.code, r.out).toBe(1);
    expect(fx.task("FX-1").evidence.at(-1)?.outcome).not.toBe("SENSITIVE");
  });

  it("rejects schema_only for executable database/admin-audit-repository.ts", () => {
    const policy = loadPolicy(REPO_ROOT);
    const t = { classification: { classes: ["DATABASE"], change_kind: "modify" }, red_exception: { category: "schema_only", reason: "migration only" } };
    expect(requiredGates(policy, t, ["packages/database/prisma/schema.prisma"]).errors).toEqual([]);
    expect(requiredGates(policy, t, ["apps/api-go/internal/postgres/migrations/010_x.sql"]).errors).toEqual([]);
    expect(requiredGates(policy, t, ["database/admin-audit-repository.ts"]).errors.join(" ")).toMatch(/schema_only/u);
  });

  it.each(["direct Go audit", "multiline verify-go invocation"])("CI rejects a %s baseline override allowing an unexpected skip", (mode) => {
    fx = makeFixture();
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, `func TestUnexpectedSkip(t *testing.T) { ${PATTERNS.goSkip}"probe") }`));
    const run = spawnSync("go", ["test", "-json", "-count=1", "./..."], { cwd: path.join(fx.dir, "apps/api-go"), encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0);
    const report = path.join(fx.dir, "tasks/.review/go.json");
    const baseline = path.join(fx.dir, "tasks/.review/weak.json");
    fx.write("tasks/.review/go.json", run.stdout);
    fx.write("tasks/.review/weak.json", JSON.stringify({ min_passed_tests: 1, allowed_skips: { "internal/calc::TestUnexpectedSkip": "probe" } }));
    const checker = path.join(REPO_ROOT, "scripts/quality/check-go-test-report.mjs");
    const local = spawnSync("node", [checker, report, "0", "--baseline", baseline], { encoding: "utf8", env: { ...process.env, GITHUB_ACTIONS: "", QUALITY_SUMMARY_DIR: "" } });
    expect(local.status, local.stderr).toBe(0);
    const env = { ...process.env, GITHUB_ACTIONS: "true", QUALITY_SUMMARY_DIR: "", REPO_ROOT, AUDIT_REPORT: report, AUDIT_BASELINE: baseline };
    const ci = mode === "direct Go audit"
      ? spawnSync("node", [checker, report, "0", "--baseline", baseline], { encoding: "utf8", env })
      : spawnSync("bash", ["-c", 'set -euo pipefail\nnode "$REPO_ROOT/scripts/quality/check-go-test-report.mjs" \\\n    "$AUDIT_REPORT" 0 \\\n    --baseline "$AUDIT_BASELINE"'], { encoding: "utf8", env });
    expect(ci.status, `${ci.stdout}\n${ci.stderr}`).toBe(2);
    expect(`${ci.stdout}\n${ci.stderr}`).toContain("TOOL_FAILURE");
    expect(`${ci.stdout}\n${ci.stderr}`).toMatch(/baseline|override/u);
  });

  it("rejects stale GREEN after a content change and fresh suite verification", () => {
    fx = makeFixture();
    begin("FX-1", "DOMAIN_LOGIC", "modify");
    fx.write(CALC_TEST, addGoTest(CALC_TEST_GO, DISCOUNT_TEST));
    expect(fx.run("red", "--go", "./internal/calc:TestDiscount", "--expect", "discount: got 200 want 180").code).toBe(0);
    fx.write(CALC, CALC_GO.replace("func Discount(total int) int { return total }", DISCOUNT_IMPL));
    expect(fx.run("green").code).toBe(0);
    const greenFingerprint = fx.task("FX-1").evidence.at(-1).fingerprint;
    fx.write(CALC, fx.read(CALC).replace("return a + b", "return b + a"));
    expect(fx.run("verify").code).toBe(0);
    expect(fx.task("FX-1").evidence.at(-1).fingerprint).not.toBe(greenFingerprint);
    const close = fx.run("close");
    expect(close.code, close.out).toBe(1);
    expect(close.out).toMatch(/green\s+STALE/u);
  });
});
