// Static quality-system invariants. These protect the gates themselves from
// edits that would make CI green without verification (continue-on-error,
// swallowed failures, baseline writes in CI, deploying an unvalidated SHA,
// unit-only Go runs, an unwired write guard, agent entrypoints without the
// policy pointer). Text-based on purpose: no YAML dependency, and every rule
// has a mutation test in invariants.test.ts.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const read = (root, rel) => {
  const abs = path.join(root, rel);
  return existsSync(abs) ? readFileSync(abs, "utf8") : null;
};

/** Strip YAML/shell comments so a commented-out step never satisfies a rule. */
const stripComments = (text) =>
  text
    .split("\n")
    .map((l) => (/^\s*#/u.test(l) ? "" : l.replace(/\s+#\s.*$/u, "")))
    .join("\n");

export const POLICY_POINTER = "docs/engineering/ENGINEERING_POLICY.md";
export const ENTRYPOINTS = ["CLAUDE.md", "AGENTS.md", "AI_CONTEXT.md", ".github/copilot-instructions.md"];

export function checkInvariants(root) {
  const v = [];
  const fail = (id, message) => v.push({ id, message });

  const workflowDir = path.join(root, ".github/workflows");
  const workflows = existsSync(workflowDir) ? readdirSync(workflowDir).filter((f) => /\.ya?ml$/u.test(f)) : [];
  for (const f of workflows) {
    const text = stripComments(read(root, `.github/workflows/${f}`));
    if (/continue-on-error\s*:\s*(?!false\b)/u.test(text)) fail("WF_NO_CONTINUE_ON_ERROR", `${f}: continue-on-error makes a failing gate green`);
    if (/\|\|\s*(?:true|:|exit 0)\b/u.test(text)) fail("WF_NO_SWALLOWED_FAILURE", `${f}: '|| true' swallows a failure`);
    if (/--update-baseline|--accept-new-debt|UPDATE_SQL_CONFORMANCE_BASELINE/u.test(text)) fail("WF_NO_BASELINE_WRITE", `${f}: CI must never write a debt baseline`);
    if (/--unit-only/u.test(text)) fail("WF_NO_UNIT_ONLY", `${f}: --unit-only skips the DB integration suite`);
  }

  const ci = read(root, ".github/workflows/ci.yml");
  if (ci === null) {
    fail("CI_PRESENT", ".github/workflows/ci.yml is missing");
  } else {
    const t = stripComments(ci);
    for (const [needle, what] of [
      ["scripts/quality/verify-go.sh", "the Go gate"],
      ["scripts/quality/verify-frontend.sh", "the frontend gate"],
      ["scripts/quality/verify-harness.sh", "the harness self-test (adversarial suite)"],
      ["scripts/quality/harness/cli.mjs check --ci", "the lifecycle check"],
      ["scripts/quality/harness/cli.mjs replay --ci", "the RED/GREEN replay"],
      ["scripts/quality/provision-test-schema.sh", "PostgreSQL schema provisioning"]
    ]) {
      if (!t.includes(needle)) fail("CI_RUNS_GATES", `ci.yml does not run ${what} (${needle})`);
    }
    if (!/TEST_DATABASE_URL\s*:/u.test(t)) fail("CI_GO_DB", "ci.yml does not provision TEST_DATABASE_URL (DB tests would skip)");
    if (!/fetch-depth\s*:\s*0/u.test(t)) fail("CI_FULL_HISTORY", "the lifecycle job needs fetch-depth: 0 to diff against the base commit");
  }

  const deploy = read(root, ".github/workflows/deploy-gcp.yml");
  if (deploy !== null) {
    const t = stripComments(deploy);
    if (!/ref\s*:\s*\$\{\{\s*github\.event\.workflow_run\.head_sha/u.test(t)) {
      fail("DEPLOY_CHECKS_OUT_VALIDATED_SHA", "deploy-gcp.yml must check out github.event.workflow_run.head_sha (the commit CI validated)");
    }
    if (/ref\s*:\s*(?:main|refs\/heads\/main|\$\{\{\s*github\.ref\s*\}\})\s*$/mu.test(t)) {
      fail("DEPLOY_NO_BRANCH_REF", "deploy-gcp.yml checks out a branch name instead of an immutable SHA");
    }
    if (!/workflow_run\.conclusion\s*==\s*'success'/u.test(t)) fail("DEPLOY_REQUIRES_CI_SUCCESS", "deploy-gcp.yml must require workflow_run.conclusion == 'success'");
    const verifyAt = t.indexOf("scripts/quality/verify-ci-passed.sh");
    const syncAt = t.indexOf("rsync");
    if (verifyAt === -1) fail("DEPLOY_VERIFIES_CI_FOR_SHA", "deploy-gcp.yml must run scripts/quality/verify-ci-passed.sh for the deployed SHA");
    else if (syncAt !== -1 && verifyAt > syncAt) fail("DEPLOY_VERIFIES_CI_FOR_SHA", "verify-ci-passed.sh must run before files are shipped");
  }

  const verifyGo = read(root, "scripts/quality/verify-go.sh");
  if (verifyGo === null) fail("VERIFY_GO_PRESENT", "scripts/quality/verify-go.sh is missing");
  else {
    const t = stripComments(verifyGo);
    if (!t.includes('-z "${TEST_DATABASE_URL:-}"')) fail("VERIFY_GO_REQUIRES_DB", "verify-go.sh must refuse to run without TEST_DATABASE_URL");
    if (!t.includes("check-go-test-report.mjs")) fail("VERIFY_GO_AUDITS_SKIPS", "verify-go.sh must audit go test -json output (skips, pass floor)");
    if (!/go test[^\n]*-json/u.test(t)) fail("VERIFY_GO_AUDITS_SKIPS", "verify-go.sh must run go test -json");
    if (/--baseline\b/u.test(t)) fail("VERIFY_GO_CANONICAL_BASELINE", "verify-go.sh must audit against the committed go-test-skips-baseline.json (no --baseline override)");
  }
  const verifyFrontend = read(root, "scripts/quality/verify-frontend.sh");
  if (verifyFrontend === null) fail("VERIFY_FRONTEND_PRESENT", "scripts/quality/verify-frontend.sh is missing");
  else {
    const t = stripComments(verifyFrontend);
    if (!t.includes("check-frontend-debt.mjs")) fail("VERIFY_FRONTEND_RATCHET", "verify-frontend.sh must run the identity debt ratchet");
    if (/--update-baseline|--accept-new-debt/u.test(t)) fail("VERIFY_FRONTEND_RATCHET", "verify-frontend.sh must not write the baseline");
  }

  const qdir = path.join(root, "scripts/quality");
  if (existsSync(qdir)) {
    for (const f of readdirSync(qdir).filter((x) => x.endsWith(".sh"))) {
      if (!/^set -euo pipefail$/mu.test(read(root, `scripts/quality/${f}`))) fail("SCRIPTS_STRICT_MODE", `scripts/quality/${f} must use 'set -euo pipefail'`);
    }
  }

  const settings = read(root, ".claude/settings.json");
  const hookWired = (() => {
    try {
      const entries = JSON.parse(settings ?? "{}")?.hooks?.PreToolUse ?? [];
      return entries.some(
        (e) =>
          ["Write", "Edit", "MultiEdit", "NotebookEdit", "Bash"].every((tool) => new RegExp(`(^|\\|)${tool}(\\||$)`, "u").test(e.matcher ?? "")) &&
          (e.hooks ?? []).some((h) => String(h.command ?? "").includes("scripts/quality/harness/hook.mjs"))
      );
    } catch {
      return false;
    }
  })();
  if (!hookWired) fail("HOOK_WIRED", ".claude/settings.json must run scripts/quality/harness/hook.mjs on PreToolUse for Write|Edit|MultiEdit|NotebookEdit|Bash");

  for (const rel of ENTRYPOINTS) {
    const text = read(root, rel);
    if (text === null) continue;
    if (!text.includes(POLICY_POINTER) || !text.includes("pnpm quality")) {
      fail("ENTRYPOINT_POINTER", `${rel} must point to ${POLICY_POINTER} and the 'pnpm quality' lifecycle`);
    }
  }
  return v;
}
