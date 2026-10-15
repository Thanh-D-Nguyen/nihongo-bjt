// Structured test targets. The harness builds the commands itself and parses
// machine-readable output, so an outcome is never inferred from an exit code
// alone: a skipped, missing or uncompiled test can never read as RED or GREEN.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { matchesAny, redact, toolFailure } from "./util.mjs";

export const OUTCOMES = Object.freeze(["PASS", "FAIL", "SKIP", "NOT_FOUND", "BUILD_FAIL"]);
const GO_TEST_NAME = /^Test[A-Za-z0-9_]*$/u;

export function targetId(t) {
  if (t.runner === "go") return `go:${t.package}:${t.test}`;
  if (t.runner === "vitest") return `vitest:${t.file}::${t.test}`;
  return `unknown:${JSON.stringify(t)}`;
}

/** Validate a target declaration. Returns a list of problems (empty when valid). */
export function validateTarget(t, { requireExpect = false } = {}) {
  const problems = [];
  if (t.runner === "go") {
    if (!/^\.\/[A-Za-z0-9_./-]+$/u.test(t.package ?? "") || t.package.includes("..")) problems.push(`go target package must look like ./internal/x (got ${JSON.stringify(t.package)})`);
    if (!GO_TEST_NAME.test(t.test ?? "")) problems.push(`go target test must be a top-level Test function name (got ${JSON.stringify(t.test)})`);
  } else if (t.runner === "vitest") {
    if (!/\.(test|spec)\.(ts|tsx|mts|mjs|js)$/u.test(t.file ?? "") || t.file.startsWith("/") || t.file.includes("..")) problems.push(`vitest target file must be a repo-relative test file (got ${JSON.stringify(t.file)})`);
    if (!String(t.test ?? "").trim()) problems.push("vitest target needs the full test name (\"suite > test\")");
  } else {
    problems.push(`unsupported runner ${JSON.stringify(t.runner)} (go | vitest)`);
  }
  if (requireExpect && !String(t.expect ?? "").trim()) problems.push(`${targetId(t)}: "expect" (text the failure must contain) is required`);
  return problems;
}

function spawn(command, args, { cwd, env, timeoutMs }) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: timeoutMs,
    killSignal: "SIGKILL",
    maxBuffer: 256 * 1024 * 1024
  });
  if (result.error) throw toolFailure(`${command} ${args.join(" ")} could not run: ${result.error.message}`);
  if (result.signal) throw toolFailure(`${command} ${args.join(" ")} was killed by ${result.signal} (timeout ${Math.round(timeoutMs / 60000)} min?)`);
  return result;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Run one Go package's targets and classify each from `go test -json` events. */
export function runGoPackage(root, policy, pkg, targets, env = {}) {
  const moduleDir = path.join(root, policy.raw.runners.go.module_dir);
  const names = targets.map((t) => t.test);
  const args = ["test", "-json", "-count=1", "-p", "1", "-run", `^(?:${names.map(escapeRe).join("|")})$`, pkg];
  const command = `cd ${policy.raw.runners.go.module_dir} && go ${args.join(" ")}`;
  const r = spawn("go", args, { cwd: moduleDir, env, timeoutMs: policy.raw.runners.go.timeout_minutes * 60000 });
  if (r.status !== 0 && r.status !== 1) {
    throw toolFailure(`go test exited ${r.status} for ${pkg}: ${redact(r.stderr, 600)}`);
  }
  const state = new Map();
  const output = new Map();
  const pkgOutput = [];
  let buildFailed = false;
  let events = 0;
  for (const line of r.stdout.split("\n")) {
    if (!line.trim()) continue;
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      pkgOutput.push(line);
      continue;
    }
    events += 1;
    if (ev.Action === "build-fail") buildFailed = true;
    if (ev.Action === "build-output" && ev.Output) pkgOutput.push(ev.Output);
    if (!ev.Test) {
      if (ev.Action === "output" && ev.Output) {
        pkgOutput.push(ev.Output);
        if (/\[(build|setup) failed\]/u.test(ev.Output)) buildFailed = true;
      }
      continue;
    }
    const top = ev.Test.split("/")[0];
    if (ev.Action === "output") output.set(top, `${output.get(top) ?? ""}${ev.Output}`);
    if (ev.Test === top && ["pass", "fail", "skip"].includes(ev.Action)) state.set(top, ev.Action);
  }
  const stderr = r.stderr ?? "";
  if (/\[(build|setup) failed\]|cannot find package|no Go files|build failed/u.test(stderr)) buildFailed = true;
  if (events === 0 && !buildFailed) throw toolFailure(`go test produced no JSON events for ${pkg}: ${redact(stderr || r.stdout, 600)}`);
  const results = targets.map((t) => {
    const s = state.get(t.test);
    const out = output.get(t.test) ?? "";
    if (s === "pass") return { id: targetId(t), outcome: "PASS", output: out };
    if (s === "fail") return { id: targetId(t), outcome: "FAIL", output: out, failure_output: out.split("\n").filter((line) => !/^(?:=== |--- )/u.test(line.trim())).join("\n") };
    if (s === "skip") return { id: targetId(t), outcome: "SKIP", output: out };
    if (buildFailed) return { id: targetId(t), outcome: "BUILD_FAIL", output: `${pkgOutput.join("")}\n${stderr}` };
    return { id: targetId(t), outcome: "NOT_FOUND", output: pkgOutput.join("") };
  });
  return { command, results };
}

export function vitestConfigFor(policy, file) {
  const match = policy.vitestConfigs.find((c) => matchesAny(file, c.regexps));
  return match ? match.config : policy.raw.runners.vitest.default_config;
}

/** Run one Vitest file's targets using the debt reporter (records per-test state + errors). */
export function runVitestFile(root, policy, file, targets, env = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "quality-vitest-"));
  try {
    const report = path.join(dir, "report.json");
    const reporter = path.join(root, "scripts/quality/vitest-debt-reporter.mjs");
    const config = vitestConfigFor(policy, file);
    const args = ["exec", "vitest", "run", file, "--config", config, `--reporter=${reporter}`];
    const command = `pnpm ${args.join(" ").replace(reporter, "scripts/quality/vitest-debt-reporter.mjs")}`;
    const r = spawn("pnpm", args, {
      cwd: root,
      env: { ...env, FRONTEND_DEBT_VITEST_REPORT: report },
      timeoutMs: policy.raw.runners.vitest.timeout_minutes * 60000
    });
    if (r.status !== 0 && r.status !== 1) throw toolFailure(`vitest exited ${r.status} for ${file}: ${redact(r.stderr || r.stdout, 600)}`);
    if (!existsSync(report)) throw toolFailure(`vitest wrote no report for ${file} (config error?): ${redact(r.stderr || r.stdout, 600)}`);
    let data;
    try {
      data = JSON.parse(readFileSync(report, "utf8"));
    } catch (error) {
      throw toolFailure(`vitest report for ${file} is not JSON: ${error.message}`);
    }
    return { command, results: classifyVitestReport(data, file, targets) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Pure: classify targets from a vitest-debt-reporter report. */
export function classifyVitestReport(data, file, targets) {
  if (data?.schema !== "frontend-debt-vitest/1" || !Array.isArray(data.modules)) throw toolFailure("vitest report has an unexpected shape");
  if (data.reason === "interrupted") throw toolFailure("vitest run was interrupted");
  if (data.unhandledErrors?.length) throw toolFailure(`vitest reported unhandled error(s): ${redact(data.unhandledErrors.join(" | "), 600)}`);
  const mod = data.modules.find((m) => m.file === file);
  return targets.map((t) => {
    const id = targetId(t);
    if (!mod) return { id, outcome: "NOT_FOUND", output: `test file ${file} was not collected` };
    if (mod.errors?.length) return { id, outcome: "BUILD_FAIL", output: mod.errors.join("\n") };
    const test = mod.tests.find((x) => x.name === t.test);
    if (!test) return { id, outcome: "NOT_FOUND", output: `no test named ${JSON.stringify(t.test)} in ${file}` };
    const out = (test.errors ?? []).join("\n");
    if (test.state === "passed") return { id, outcome: "PASS", output: out };
    if (test.state === "failed") return { id, outcome: "FAIL", output: out, assertion_failure: test.error_names?.length > 0 && test.error_names.every((name) => name === "AssertionError") };
    if (test.state === "skipped") return { id, outcome: "SKIP", output: out };
    throw toolFailure(`test ${id} did not finish (state=${test.state})`);
  });
}

/**
 * Run every target against the tree at `root`. Throws HarnessError(TOOL_FAILURE)
 * when a runner cannot produce a trustworthy result.
 */
export function runTargets(root, policy, targets, env = {}) {
  const commands = [];
  const results = [];
  const groups = new Map();
  for (const t of targets) {
    const problems = validateTarget(t);
    if (problems.length) throw toolFailure(problems.join("; "));
    const key = t.runner === "go" ? `go\0${t.package}` : `vitest\0${t.file}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  for (const [key, group] of groups) {
    const [runner, where] = key.split("\0");
    const r = runner === "go" ? runGoPackage(root, policy, where, group, env) : runVitestFile(root, policy, where, group, env);
    commands.push(r.command);
    results.push(...r.results);
  }
  return { commands, results };
}

/** Infra/tooling signature in failure output => the failure is not caused by the targeted behavior. */
export function infraSignature(policy, output) {
  return (policy.raw.invalid_red_signatures ?? []).find((sig) => String(output).includes(sig)) ?? null;
}

/**
 * Judge a RED run. A target is VALID only if it executed, failed, the failure
 * contains its declared `expect` text and shows no infrastructure signature.
 */
export function judgeRed(policy, targets, results) {
  const byId = new Map(results.map((r) => [r.id, r]));
  const judged = targets.map((t) => {
    const id = targetId(t);
    const r = byId.get(id);
    if (!r) return { id, valid: false, outcome: "NOT_FOUND", reason: "no result" };
    const base = { id, outcome: r.outcome, excerpt: redact(r.output, 300) };
    if (r.outcome === "PASS") return { ...base, valid: false, reason: "test passes before the change: behavior already exists (characterization, not TDD) or the test does not exercise it" };
    if (r.outcome === "SKIP") return { ...base, valid: false, reason: "test was skipped — a skip is neither RED nor GREEN (missing TEST_DATABASE_URL? run under scripts/quality/with-test-db.sh)" };
    if (r.outcome === "NOT_FOUND") return { ...base, valid: false, reason: "test not found/collected" };
    if (r.outcome === "BUILD_FAIL") return { ...base, valid: false, reason: "compile/import failure is not a valid RED (use red_exception new_component + sensitivity for brand-new code)" };
    if (/^(?:panic:|fatal error:|\[signal SIG)/mu.test(r.output) || r.assertion_failure === false) return { ...base, valid: false, reason: "runtime crash or non-assertion exception is not a valid RED/sensitivity failure" };
    const sig = infraSignature(policy, r.output);
    if (sig) return { ...base, valid: false, reason: `failure shows an infrastructure/tooling signature (${JSON.stringify(sig)})` };
    if (!String(r.failure_output ?? r.output).includes(t.expect)) return { ...base, valid: false, reason: `failure output does not contain the expected text ${JSON.stringify(t.expect)}` };
    return { ...base, valid: true, reason: "failed for the declared reason" };
  });
  return { valid: judged.length > 0 && judged.every((j) => j.valid), targets: judged };
}

export function judgeGreen(targets, results) {
  const byId = new Map(results.map((r) => [r.id, r]));
  const judged = targets.map((t) => {
    const id = targetId(t);
    const r = byId.get(id);
    return { id, outcome: r?.outcome ?? "NOT_FOUND", valid: r?.outcome === "PASS", excerpt: r && r.outcome !== "PASS" ? redact(r.output, 300) : undefined };
  });
  return { valid: judged.length > 0 && judged.every((j) => j.valid), targets: judged };
}
