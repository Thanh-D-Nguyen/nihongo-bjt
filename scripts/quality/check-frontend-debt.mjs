#!/usr/bin/env node
// Frontend debt ratchet: known lint/test debt may remain, NEW debt fails.
//
// Usage:
//   node scripts/quality/check-frontend-debt.mjs                     # check (CI)
//   node scripts/quality/check-frontend-debt.mjs --update-baseline   # shrink baseline after fixing debt
//   node scripts/quality/check-frontend-debt.mjs --update-baseline --accept-new-debt
//                                                                    # explicitly accept new debt (reviewed)
//
// Exit codes: 0 PASS · 1 RATCHET_VIOLATION (new debt, stale baseline, coverage floor) · 2 TOOL_FAILURE.
// The baseline is only ever written by --update-baseline; CI never mutates it.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ToolFailure,
  buildBaseline,
  collectLintDebt,
  collectTestDebt,
  compareDebt,
  validateBaseline
} from "./frontend-debt-lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const baselinePath = path.join(repoRoot, "scripts/quality/frontend-debt-baseline.json");
const reporterPath = path.join(repoRoot, "scripts/quality/vitest-debt-reporter.mjs");
const args = new Set(process.argv.slice(2));
const updateBaseline = args.has("--update-baseline");
const acceptNewDebt = args.has("--accept-new-debt");
const minutes = (name, fallback) => Number(process.env[name] ?? fallback) * 60_000;

function annotate(level, message) {
  if (process.env.GITHUB_ACTIONS) console.log(`::${level} title=frontend-debt::${message}`);
}

function run(label, command, commandArgs, { env = {}, timeoutMs }) {
  console.log(`\n=== ${label}: ${command} ${commandArgs.join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdio: ["ignore", "inherit", "inherit"],
    timeout: timeoutMs,
    killSignal: "SIGKILL"
  });
  if (result.error) throw new ToolFailure(`${label} could not run: ${result.error.message}`);
  if (result.signal) throw new ToolFailure(`${label} was killed by ${result.signal} (timeout ${timeoutMs / 60_000} min?)`);
  return result.status;
}

function readJson(file, label) {
  if (!existsSync(file)) throw new ToolFailure(`${label} did not produce a report (${file})`);
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new ToolFailure(`${label} report is not valid JSON: ${error.message}`);
  }
}

/**
 * Files in the git index — exactly what a CI checkout contains. Untracked and
 * gitignored local files are linted by `eslint .` on a developer machine but
 * must not count: they would give CI hidden slack or make the baseline go
 * stale. Stage (`git add`) new files before running locally.
 */
function indexedFiles() {
  const result = spawnSync("git", ["ls-files", "--cached", "-z"], {
    cwd: repoRoot,
    maxBuffer: 256 * 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    throw new ToolFailure(`git ls-files failed: ${result.error?.message ?? result.stderr?.toString()}`);
  }
  return new Set(result.stdout.toString().split("\0").filter(Boolean));
}

function measure() {
  const files = indexedFiles();
  const isMeasured = (rel) => files.has(rel);
  const dir = mkdtempSync(path.join(os.tmpdir(), "frontend-debt-"));
  try {
    // Invoke the canonical package scripts so the ratchet follows `pnpm lint` / `pnpm test`.
    const eslintReport = path.join(dir, "eslint.json");
    const lintExit = run("lint", "pnpm", ["lint", "--format", "json", "--output-file", eslintReport], {
      timeoutMs: minutes("FRONTEND_DEBT_LINT_TIMEOUT_MIN", 15)
    });
    const lint = collectLintDebt({ report: readJson(eslintReport, "ESLint"), exitCode: lintExit, repoRoot, isMeasured });

    const vitestReport = path.join(dir, "vitest.json");
    const testExit = run("test", "pnpm", ["test", "--reporter=default", `--reporter=${reporterPath}`], {
      env: { FRONTEND_DEBT_VITEST_REPORT: vitestReport },
      timeoutMs: minutes("FRONTEND_DEBT_TEST_TIMEOUT_MIN", 20)
    });
    const tests = collectTestDebt({ report: readJson(vitestReport, "Vitest"), exitCode: testExit, isMeasured });
    for (const [label, list] of [["lint", lint.unmeasured], ["test", tests.unmeasured]]) {
      if (list.length) console.log(`(not measured — ${list.length} ${label} file(s) not in the git index, absent in CI)`);
    }
    return { lint, tests };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function loadBaseline() {
  if (!existsSync(baselinePath)) throw new ToolFailure(`baseline not found: ${baselinePath}`);
  return validateBaseline(readJson(baselinePath, "baseline"));
}

function printItems(title, items) {
  if (!items.length) return;
  console.log(`\n${title}`);
  for (const item of items) console.log(`  - [${item.kind}] ${item.id}${item.delta > 1 ? ` (x${item.delta})` : ""}`);
}

function main() {
  const current = measure();
  console.log(
    `\nCurrent: eslint errors=${current.lint.errorCount} warnings=${current.lint.warningCount} files=${current.lint.lintedFiles}; ` +
      `vitest files=${current.tests.testFiles} tests=${current.tests.tests} failing=${current.tests.failures.length} skipped=${current.tests.skipped.length}`
  );

  if (updateBaseline) {
    let previous = null;
    try {
      previous = loadBaseline();
    } catch (error) {
      if (!acceptNewDebt) throw error;
    }
    if (previous) {
      const { newDebt, resolved } = compareDebt(previous, current);
      printItems("Removed from baseline (fixed):", resolved);
      if (newDebt.length && !acceptNewDebt) {
        printItems("NEW debt (refusing to baseline without --accept-new-debt):", newDebt);
        return 1;
      }
      printItems("NEW debt explicitly accepted:", newDebt);
    }
    writeFileSync(baselinePath, `${JSON.stringify(buildBaseline(current), null, 2)}\n`);
    console.log(`\nBaseline written: ${path.relative(repoRoot, baselinePath)} — commit it for review.`);
    return 0;
  }

  const { newDebt, resolved, floors } = compareDebt(loadBaseline(), current);
  if (newDebt.length || floors.length) {
    printItems("NEW debt (not in baseline):", newDebt);
    for (const f of floors) console.log(`  - [coverage-floor] ${f}`);
    for (const item of newDebt) annotate("error", `new ${item.kind}: ${item.id}`);
    for (const f of floors) annotate("error", f);
    console.log("\nRESULT: RATCHET_VIOLATION — fix the new debt. Deliberate test/file removals need a reviewed baseline update.");
    return 1;
  }
  if (resolved.length) {
    printItems("Fixed debt still listed in the baseline:", resolved);
    annotate("error", "baseline is stale: run `node scripts/quality/check-frontend-debt.mjs --update-baseline` and commit");
    console.log("\nRESULT: BASELINE_STALE — run `node scripts/quality/check-frontend-debt.mjs --update-baseline` and commit the shrunken baseline.");
    return 1;
  }
  console.log("\nRESULT: PASS — no debt beyond the committed baseline.");
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  // Any unexpected error is also a tool failure: it must never read as PASS
  // or be confused with a ratchet violation.
  const message = error instanceof ToolFailure ? error.message : (error?.stack ?? String(error));
  console.error(`\nRESULT: TOOL_FAILURE — ${message}`);
  annotate("error", `tool failure: ${error?.message ?? error}`);
  process.exitCode = 2;
}
