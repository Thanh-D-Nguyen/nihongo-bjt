// Harness self-test: quality-system invariants + the harness test suite
// (unit, lifecycle e2e, adversarial mutation tests) with execution accounting.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { checkInvariants } from "./invariants.mjs";
import { writeSuiteSummary } from "./summary.mjs";
import { toolFailure } from "./util.mjs";

const CONFIG = "scripts/quality/harness/vitest.config.mjs";

/** Pure: accounting + verdict for a harness vitest report. */
export function summarizeHarnessReport(report, exitCode, requiredFiles) {
  if (exitCode !== 0 && exitCode !== 1) throw toolFailure(`vitest exited with code ${exitCode}`);
  if (report?.schema !== "frontend-debt-vitest/1" || !Array.isArray(report.modules)) throw toolFailure("harness vitest report missing or malformed");
  if (report.reason === "interrupted") throw toolFailure("harness vitest run was interrupted");
  if (report.unhandledErrors?.length) throw toolFailure(`unhandled errors: ${report.unhandledErrors.join(" | ")}`);
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const failures = [];
  for (const mod of report.modules) {
    if (mod.errors?.length) {
      failed += 1;
      failures.push(`${mod.file} > <module error>`);
    }
    for (const t of mod.tests) {
      if (t.state === "passed") passed += 1;
      else if (t.state === "failed") {
        failed += 1;
        failures.push(`${mod.file} > ${t.name}`);
      } else if (t.state === "skipped") skipped += 1;
      else throw toolFailure(`test did not finish: ${mod.file} > ${t.name} (${t.state})`);
    }
  }
  const executed = passed + failed;
  if (executed === 0) throw toolFailure("zero harness tests executed");
  if ((exitCode === 1) !== failed > 0) throw toolFailure(`vitest exit ${exitCode} inconsistent with ${failed} failure(s)`);
  const files = new Set(report.modules.map((m) => m.file));
  const missingFiles = requiredFiles.filter((f) => !files.has(f));
  const emptyFiles = requiredFiles.filter((f) => files.has(f) && !report.modules.find((m) => m.file === f).tests.length);
  const problems = [
    ...failures.map((f) => `failed: ${f}`),
    ...(skipped ? [`${skipped} skipped test(s) — no skips are allowed in the harness suite`] : []),
    ...missingFiles.map((f) => `required self-test file not collected: ${f}`),
    ...emptyFiles.map((f) => `required self-test file has no tests: ${f}`)
  ];
  return {
    result: problems.length ? "VIOLATION" : "PASS",
    problems,
    accounting: { discovered: executed + skipped, executed, passed, failed, skipped, expected_skips: 0, unexpected_skips: skipped }
  };
}

export function runSelfTest(root, policy) {
  const invariantViolations = checkInvariants(root);
  for (const v of invariantViolations) console.error(`[invariant ${v.id}] ${v.message}`);

  const dir = mkdtempSync(path.join(os.tmpdir(), "quality-selftest-"));
  try {
    const report = path.join(dir, "report.json");
    const reporter = path.join(root, "scripts/quality/vitest-debt-reporter.mjs");
    console.log(`=== harness tests: pnpm exec vitest run --config ${CONFIG}`);
    const r = spawnSync("pnpm", ["exec", "vitest", "run", "--config", CONFIG, "--reporter=default", `--reporter=${reporter}`], {
      cwd: root,
      env: { ...process.env, FRONTEND_DEBT_VITEST_REPORT: report },
      stdio: ["ignore", "inherit", "inherit"],
      timeout: 30 * 60000,
      killSignal: "SIGKILL"
    });
    if (r.error) throw toolFailure(`vitest could not run: ${r.error.message}`);
    if (r.signal) throw toolFailure(`vitest killed by ${r.signal}`);
    if (!existsSync(report)) throw toolFailure("harness vitest wrote no report (config error?)");
    const summary = summarizeHarnessReport(JSON.parse(readFileSync(report, "utf8")), r.status, policy.raw.harness.required_self_test_files);
    if (invariantViolations.length) {
      summary.result = "VIOLATION";
      summary.problems.unshift(`${invariantViolations.length} quality-system invariant violation(s)`);
    }
    writeSuiteSummary("harness", summary.result, summary.accounting, summary.problems.join("; "));
    return summary;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
