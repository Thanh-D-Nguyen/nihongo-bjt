// Pure logic for the frontend debt ratchet (see check-frontend-debt.mjs).
// Kept free of I/O so every false-green scenario is unit tested in
// frontend-debt-lib.test.ts.
import path from "node:path";

export const BASELINE_SCHEMA_VERSION = 2;

/** Infrastructure/tool failure. Never acceptable as known debt. */
export class ToolFailure extends Error {
  constructor(message) {
    super(message);
    this.name = "ToolFailure";
  }
}

const toPosix = (p) => p.split(path.sep).join("/");

// ---------------------------------------------------------------- ESLint

/** Stable, line-independent identity of one ESLint message: "<severity>:<rule>". */
export function lintKey(message) {
  const severity = message.severity === 2 ? "error" : message.severity === 1 ? "warning" : null;
  if (!severity) throw new ToolFailure(`unexpected ESLint severity ${JSON.stringify(message.severity)}`);
  let rule = message.ruleId;
  if (!rule) {
    if (message.fatal) rule = "<parse-error>";
    else if (/^Unused eslint-disable directive/u.test(message.message ?? "")) rule = "<unused-disable-directive>";
    else rule = "<no-rule>";
  }
  return `${severity}:${rule}`;
}

/**
 * Interpret `eslint --format json` output. ESLint exits 0 (no errors),
 * 1 (lint errors) or 2 (config/crash); anything that does not line up with
 * the report contents is treated as a tool failure.
 *
 * `isMeasured(relPath)` limits the measurement to files in the git index.
 * Untracked/gitignored local files are linted by `eslint .` on a developer
 * machine but never exist in CI, so counting them would give CI hidden slack.
 */
export function collectLintDebt({ report, exitCode, repoRoot, isMeasured = () => true }) {
  if (exitCode !== 0 && exitCode !== 1) {
    throw new ToolFailure(`ESLint exited with code ${exitCode} (2 = configuration error or crash)`);
  }
  if (!Array.isArray(report)) throw new ToolFailure("ESLint report is not a JSON array");
  const violations = {};
  let errorCount = 0;
  let warningCount = 0;
  let rawErrorCount = 0;
  let lintedFiles = 0;
  const unmeasured = [];
  for (const file of report) {
    if (!file || typeof file.filePath !== "string" || !Array.isArray(file.messages)) {
      throw new ToolFailure("ESLint report entry has an unexpected shape");
    }
    const rel = toPosix(path.relative(repoRoot, file.filePath));
    if (rel.startsWith("..")) throw new ToolFailure(`ESLint reported a file outside the repository: ${file.filePath}`);
    let fileErrors = 0;
    let fileWarnings = 0;
    const keys = file.messages.map((message) => {
      if (message.severity === 2) fileErrors += 1;
      else fileWarnings += 1;
      return lintKey(message);
    });
    if (typeof file.errorCount === "number" && file.errorCount !== fileErrors) {
      throw new ToolFailure(`ESLint errorCount mismatch for ${rel}: ${file.errorCount} vs ${fileErrors} messages`);
    }
    rawErrorCount += fileErrors;
    if (!isMeasured(rel)) {
      unmeasured.push(rel);
      continue;
    }
    lintedFiles += 1;
    errorCount += fileErrors;
    warningCount += fileWarnings;
    for (const key of keys) {
      violations[rel] ??= {};
      violations[rel][key] = (violations[rel][key] ?? 0) + 1;
    }
  }
  // The exit code reflects everything ESLint saw, including unmeasured files.
  if ((exitCode === 1) !== rawErrorCount > 0) {
    throw new ToolFailure(`ESLint exit code ${exitCode} is inconsistent with ${rawErrorCount} reported errors`);
  }
  if (lintedFiles === 0) throw new ToolFailure("ESLint linted zero repository files");
  return { lintedFiles, errorCount, warningCount, violations, unmeasured };
}

// ---------------------------------------------------------------- Vitest

/**
 * Interpret the report written by vitest-debt-reporter.mjs. Failing tests are
 * identified by "<file> > <suite> > <test>"; file-level failures (import,
 * collection, hook errors) by "<file> > <module error>".
 */
export function collectTestDebt({ report, exitCode, isMeasured = () => true }) {
  if (exitCode !== 0 && exitCode !== 1) throw new ToolFailure(`Vitest exited with code ${exitCode}`);
  if (!report || report.schema !== "frontend-debt-vitest/1" || !Array.isArray(report.modules)) {
    throw new ToolFailure("Vitest debt report missing or has an unexpected shape");
  }
  if (report.reason === "interrupted") throw new ToolFailure("Vitest run was interrupted");
  if (report.unhandledErrors?.length) {
    throw new ToolFailure(`Vitest reported ${report.unhandledErrors.length} unhandled error(s): ${report.unhandledErrors.join(" | ")}`);
  }
  const failures = [];
  const skipped = [];
  const unmeasured = [];
  let rawFailures = 0;
  let testFiles = 0;
  let tests = 0;
  for (const mod of report.modules) {
    const modFailures = [];
    if (mod.errors?.length) modFailures.push(`${mod.file} > <module error>`);
    const modSkipped = [];
    for (const test of mod.tests) {
      const id = `${mod.file} > ${test.name}`;
      if (test.state === "failed") modFailures.push(id);
      else if (test.state === "skipped") modSkipped.push(id);
      else if (test.state !== "passed") throw new ToolFailure(`test did not finish (state=${test.state}): ${id}`);
    }
    rawFailures += modFailures.length;
    if (!isMeasured(mod.file)) {
      unmeasured.push(mod.file);
      continue;
    }
    testFiles += 1;
    tests += mod.tests.length;
    failures.push(...modFailures);
    skipped.push(...modSkipped);
  }
  if (testFiles === 0 || tests === 0) throw new ToolFailure("Vitest collected zero repository tests");
  if ((exitCode === 1) !== rawFailures > 0) {
    throw new ToolFailure(`Vitest exit code ${exitCode} is inconsistent with ${rawFailures} identified failure(s)`);
  }
  return { testFiles, tests, failures: failures.sort(), skipped: skipped.sort(), unmeasured };
}

// ---------------------------------------------------------------- Baseline

export function buildBaseline({ lint, tests }) {
  const violations = {};
  for (const file of Object.keys(lint.violations).sort()) {
    violations[file] = {};
    for (const key of Object.keys(lint.violations[file]).sort()) violations[file][key] = lint.violations[file][key];
  }
  return {
    schema_version: BASELINE_SCHEMA_VERSION,
    note: "Known frontend debt. Generated by `node scripts/quality/check-frontend-debt.mjs --update-baseline`; CI never writes this file. Every change must be reviewed.",
    eslint: { min_linted_files: lint.lintedFiles, violations },
    vitest: {
      min_test_files: tests.testFiles,
      min_tests: tests.tests,
      known_failures: [...tests.failures],
      known_skipped: [...tests.skipped]
    }
  };
}

export function validateBaseline(baseline) {
  const ok =
    baseline &&
    baseline.schema_version === BASELINE_SCHEMA_VERSION &&
    baseline.eslint &&
    Number.isInteger(baseline.eslint.min_linted_files) &&
    baseline.eslint.violations &&
    typeof baseline.eslint.violations === "object" &&
    Object.values(baseline.eslint.violations).every(
      (rules) => rules && Object.values(rules).every((n) => Number.isInteger(n) && n > 0)
    ) &&
    baseline.vitest &&
    Number.isInteger(baseline.vitest.min_test_files) &&
    Number.isInteger(baseline.vitest.min_tests) &&
    Array.isArray(baseline.vitest.known_failures) &&
    Array.isArray(baseline.vitest.known_skipped);
  if (!ok) throw new ToolFailure(`baseline is missing or not schema_version ${BASELINE_SCHEMA_VERSION}`);
  return baseline;
}

const countBy = (items) => items.reduce((m, id) => m.set(id, (m.get(id) ?? 0) + 1), new Map());

function diffMultiset(kind, baseItems, currentItems, newDebt, resolved) {
  const base = countBy(baseItems);
  const cur = countBy(currentItems);
  for (const [id, n] of cur) if (n > (base.get(id) ?? 0)) newDebt.push({ kind, id, delta: n - (base.get(id) ?? 0) });
  for (const [id, n] of base) if (n > (cur.get(id) ?? 0)) resolved.push({ kind, id, delta: n - (cur.get(id) ?? 0) });
}

/**
 * Compare current debt to the committed baseline. Anything not in the
 * baseline is NEW debt; baseline entries that no longer occur are RESOLVED
 * and must be removed from the baseline in the same change (otherwise the
 * slack would let the debt silently come back).
 */
export function compareDebt(baseline, current) {
  const newDebt = [];
  const resolved = [];
  const floors = [];
  const baseLint = baseline.eslint.violations;
  const curLint = current.lint.violations;
  for (const file of Object.keys(curLint)) {
    for (const [key, n] of Object.entries(curLint[file])) {
      const b = baseLint[file]?.[key] ?? 0;
      if (n > b) newDebt.push({ kind: "lint", id: `${file} [${key}]`, delta: n - b });
    }
  }
  for (const file of Object.keys(baseLint)) {
    for (const [key, b] of Object.entries(baseLint[file])) {
      const n = curLint[file]?.[key] ?? 0;
      if (n < b) resolved.push({ kind: "lint", id: `${file} [${key}]`, delta: b - n });
    }
  }
  diffMultiset("failing-test", baseline.vitest.known_failures, current.tests.failures, newDebt, resolved);
  diffMultiset("skipped-test", baseline.vitest.known_skipped, current.tests.skipped, newDebt, resolved);
  if (current.lint.lintedFiles < baseline.eslint.min_linted_files) {
    floors.push(`ESLint linted ${current.lint.lintedFiles} files, baseline floor is ${baseline.eslint.min_linted_files}`);
  }
  if (current.tests.testFiles < baseline.vitest.min_test_files) {
    floors.push(`Vitest ran ${current.tests.testFiles} test files, baseline floor is ${baseline.vitest.min_test_files}`);
  }
  if (current.tests.tests < baseline.vitest.min_tests) {
    floors.push(`Vitest ran ${current.tests.tests} tests, baseline floor is ${baseline.vitest.min_tests}`);
  }
  return { newDebt, resolved, floors };
}
