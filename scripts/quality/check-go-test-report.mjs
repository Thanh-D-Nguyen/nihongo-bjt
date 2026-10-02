#!/usr/bin/env node
// Go test result audit: `go test` reports PASS even when integration tests
// t.Skip() (e.g. TEST_DATABASE_URL missing), so a green run can hide that
// most of the suite never executed. This audit fails on:
//   - the go test exit status being non-zero (status is passed in, never swallowed)
//   - any skipped test not listed in go-test-skips-baseline.json
//   - an allowed skip that no longer skips (baseline must shrink)
//   - fewer passed tests than the baseline floor (tests silently not compiled/collected)
//   - unparseable output
//
// Usage: node scripts/quality/check-go-test-report.mjs <go-test.json> <go-test-exit-status>
// Exit codes: 0 PASS · 1 violation · 2 tool failure.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const baselinePath = path.join(repoRoot, "scripts/quality/go-test-skips-baseline.json");
const modulePrefix = "github.com/kotobawork/nihongo-bjt/api-go/";

function fail(code, message) {
  console.error(`\nRESULT: ${code === 2 ? "TOOL_FAILURE" : "VIOLATION"} — ${message}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=go-test-audit::${message.split("\n")[0]}`);
  process.exit(code);
}

const [reportPath, statusArg] = process.argv.slice(2);
if (!reportPath || statusArg === undefined) fail(2, "usage: check-go-test-report.mjs <go-test.json> <exit-status>");
if (!existsSync(reportPath)) fail(2, `go test report not found: ${reportPath}`);
const goStatus = Number(statusArg);
if (!Number.isInteger(goStatus)) fail(2, `invalid go test exit status ${JSON.stringify(statusArg)}`);

let baseline;
try {
  baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
} catch (error) {
  fail(2, `cannot read ${path.relative(repoRoot, baselinePath)}: ${error.message}`);
}
if (!Number.isInteger(baseline.min_passed_tests) || typeof baseline.allowed_skips !== "object") {
  fail(2, "go-test-skips-baseline.json has an unexpected shape");
}

const final = new Map(); // "pkg::Test" -> pass|fail|skip
const output = new Map(); // "pkg::Test" -> output lines
const failedPackages = new Set();
let events = 0;
for (const [i, line] of readFileSync(reportPath, "utf8").split("\n").entries()) {
  if (!line.trim()) continue;
  let ev;
  try {
    ev = JSON.parse(line);
  } catch {
    fail(2, `line ${i + 1} of the go test report is not JSON (build output leaked?): ${line.slice(0, 200)}`);
  }
  events += 1;
  const pkg = (ev.Package ?? "").replace(modulePrefix, "");
  if (!ev.Test) {
    if (ev.Action === "fail") failedPackages.add(pkg);
    continue;
  }
  const id = `${pkg}::${ev.Test}`;
  if (ev.Action === "output") output.set(id, [...(output.get(id) ?? []), ev.Output]);
  if (ev.Action === "pass" || ev.Action === "fail" || ev.Action === "skip") final.set(id, ev.Action);
}
if (events === 0) fail(2, "go test report is empty");

const byState = (state) => [...final].filter(([, s]) => s === state).map(([id]) => id).sort();
const failed = byState("fail");
const skipped = byState("skip");
const passed = byState("pass");
console.log(`go test: passed=${passed.length} failed=${failed.length} skipped=${skipped.length} exit=${goStatus}`);

if (goStatus !== 0 || failed.length || failedPackages.size) {
  for (const id of failed) console.error(`\n--- FAIL ${id}\n${(output.get(id) ?? []).join("")}`);
  for (const pkg of failedPackages) console.error(`--- FAIL package ${pkg}`);
  fail(1, `go test failed (exit ${goStatus}; ${failed.length} failing test(s), ${failedPackages.size} failing package(s))`);
}

const allowed = new Set(Object.keys(baseline.allowed_skips));
const newSkips = skipped.filter((id) => !allowed.has(id));
const staleSkips = [...allowed].filter((id) => final.get(id) !== "skip").sort();
if (newSkips.length) {
  for (const id of newSkips) console.error(`  - skipped: ${id}\n      ${(output.get(id) ?? []).filter((l) => !/^(=== |--- )/u.test(l.trim())).join("").trim()}`);
  fail(1, `${newSkips.length} test(s) skipped that are not in go-test-skips-baseline.json — skipped tests are not verification`);
}
if (staleSkips.length) {
  for (const id of staleSkips) console.error(`  - no longer skipped: ${id}`);
  fail(1, "allowed skips no longer skip; remove them from scripts/quality/go-test-skips-baseline.json");
}
if (passed.length < baseline.min_passed_tests) {
  fail(1, `only ${passed.length} tests passed, baseline floor is ${baseline.min_passed_tests} (tests not compiled/collected? deliberate removals need a reviewed baseline update)`);
}
console.log(`RESULT: PASS — ${passed.length} passed, ${skipped.length} allowed skip(s).`);
