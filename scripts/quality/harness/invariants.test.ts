// Quality-system invariants: the real repository must satisfy every rule, and
// every rule must fire when its protection is removed (mutation tests run on
// a copy; the real files are never edited).
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ENTRYPOINTS, checkInvariants } from "./lib/invariants.mjs";
import { PATTERNS, REPO_ROOT } from "./fixture";

const FILES = [".github/workflows/ci.yml", ".github/workflows/deploy-gcp.yml", ".claude/settings.json", ...ENTRYPOINTS];

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function copy() {
  dir = mkdtempSync(path.join(os.tmpdir(), "invariants-"));
  for (const rel of FILES) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    cpSync(path.join(REPO_ROOT, rel), path.join(dir, rel));
  }
  cpSync(path.join(REPO_ROOT, "scripts/quality"), path.join(dir, "scripts/quality"), { recursive: true, filter: (src) => !src.includes("/harness/") || src.endsWith("/harness") });
  return dir;
}

function mutate(rel: string, from: string | RegExp, to: string) {
  const file = path.join(dir!, rel);
  const before = readFileSync(file, "utf8");
  const after = before.replace(from, to);
  expect(after, `mutation of ${rel} did not apply`).not.toBe(before);
  writeFileSync(file, after);
}

const violated = () => checkInvariants(dir!).map((v: any) => v.id);

describe("quality-system invariants", () => {
  it("hold for the real repository", () => {
    expect(checkInvariants(REPO_ROOT)).toEqual([]);
  });

  it("a pristine copy is clean (the mutation baseline)", () => {
    copy();
    expect(violated()).toEqual([]);
  });

  it.each([
    ["continue-on-error in CI", ".github/workflows/ci.yml", "timeout-minutes: 30", `timeout-minutes: 30\n    ${PATTERNS.continueOnError}`, "WF_NO_CONTINUE_ON_ERROR"],
    ["or-true in CI", ".github/workflows/ci.yml", "run: bash scripts/quality/verify-go.sh", `run: bash scripts/quality/verify-go.sh ${PATTERNS.orTrue}`, "WF_NO_SWALLOWED_FAILURE"],
    ["CI writes a baseline", ".github/workflows/ci.yml", "run: bash scripts/quality/verify-go.sh", "run: node scripts/quality/check-frontend-debt.mjs --update-baseline", "WF_NO_BASELINE_WRITE"],
    ["Go gate dropped from CI", ".github/workflows/ci.yml", "run: bash scripts/quality/verify-go.sh", "run: echo skipped", "CI_RUNS_GATES"],
    ["unit-only Go run in CI", ".github/workflows/ci.yml", "run: bash scripts/quality/verify-go.sh", "run: bash scripts/quality/verify-go.sh --unit-only", "WF_NO_UNIT_ONLY"],
    ["Go gate commented out", ".github/workflows/ci.yml", "      - run: bash scripts/quality/verify-go.sh", "      # - run: bash scripts/quality/verify-go.sh", "CI_RUNS_GATES"],
    ["lifecycle check dropped", ".github/workflows/ci.yml", "cli.mjs check --ci", "cli.mjs status", "CI_RUNS_GATES"],
    ["replay dropped", ".github/workflows/ci.yml", "cli.mjs replay --ci", "cli.mjs status", "CI_RUNS_GATES"],
    ["DB not provisioned", ".github/workflows/ci.yml", /TEST_DATABASE_URL:/gu, "NO_DB:", "CI_GO_DB"],
    ["shallow clone for the lifecycle job", ".github/workflows/ci.yml", "fetch-depth: 0", "fetch-depth: 1", "CI_FULL_HISTORY"],
    ["deploy checks out latest main", ".github/workflows/deploy-gcp.yml", "ref: ${{ github.event.workflow_run.head_sha || github.sha }}", "ref: main", "DEPLOY_CHECKS_OUT_VALIDATED_SHA"],
    ["deploy checks out a branch ref", ".github/workflows/deploy-gcp.yml", "ref: ${{ github.event.workflow_run.head_sha || github.sha }}", "ref: ${{ github.event.workflow_run.head_sha }}\n          path: x\n      - uses: actions/checkout@v4\n        with:\n          ref: main", "DEPLOY_NO_BRANCH_REF"],
    ["deploy ignores CI conclusion", ".github/workflows/deploy-gcp.yml", "github.event.workflow_run.conclusion == 'success'", "true", "DEPLOY_REQUIRES_CI_SUCCESS"],
    ["deploy skips the SHA gate", ".github/workflows/deploy-gcp.yml", "bash scripts/quality/verify-ci-passed.sh \"$DEPLOY_SHA\"", "echo trust-me", "DEPLOY_VERIFIES_CI_FOR_SHA"],
    ["Go gate runs without a database", "scripts/quality/verify-go.sh", 'if [ "$UNIT_ONLY" -eq 0 ] && [ -z "${TEST_DATABASE_URL:-}" ]; then', "if false; then", "VERIFY_GO_REQUIRES_DB"],
    ["Go audit against a weaker baseline", "scripts/quality/verify-go.sh", 'node "$REPO_ROOT/scripts/quality/check-go-test-report.mjs" "$report" "$status"', 'node "$REPO_ROOT/scripts/quality/check-go-test-report.mjs" "$report" "$status" --baseline /tmp/weak.json', "VERIFY_GO_CANONICAL_BASELINE"],
    ["Go skip audit removed", "scripts/quality/verify-go.sh", 'node "$REPO_ROOT/scripts/quality/check-go-test-report.mjs" "$report" "$status"', "true", "VERIFY_GO_AUDITS_SKIPS"],
    ["frontend ratchet removed", "scripts/quality/verify-frontend.sh", "node scripts/quality/check-frontend-debt.mjs", "pnpm lint", "VERIFY_FRONTEND_RATCHET"],
    ["frontend gate rewrites the baseline", "scripts/quality/verify-frontend.sh", "node scripts/quality/check-frontend-debt.mjs", "node scripts/quality/check-frontend-debt.mjs --update-baseline", "VERIFY_FRONTEND_RATCHET"],
    ["quality script without strict mode", "scripts/quality/verify-harness.sh", "set -euo pipefail", "set -e", "SCRIPTS_STRICT_MODE"],
    ["write guard unwired", ".claude/settings.json", "Write|Edit|MultiEdit|NotebookEdit|Bash", "Write", "HOOK_WIRED"],
    ["agent entrypoint loses the policy pointer", "AGENTS.md", /docs\/engineering\/ENGINEERING_POLICY\.md/gu, "somewhere", "ENTRYPOINT_POINTER"]
  ])("detects: %s", (_name, rel, from, to, id) => {
    copy();
    mutate(rel, from, to);
    expect(violated()).toContain(id);
  });
});
