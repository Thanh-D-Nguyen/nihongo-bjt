// Independent review: a deterministic package (diff + contract + machine
// evidence + policy), reviewed in a fresh session/process that treats the
// builder's statements as untrusted claims.
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { git, headSha } from "./git.mjs";
import { sha256, redact, toolFailure } from "./util.mjs";
import { orderedGates } from "./task.mjs";

const MAX_DIFF_BYTES = 400_000;

function ownedDiff(root, task, owned) {
  const chunks = [];
  for (const p of Object.keys(owned).sort()) {
    let out = git(root, ["diff", "--no-renames", task.start_head, "--", p]).stdout;
    if (!out) out = git(root, ["diff", "--no-index", "--", "/dev/null", p], { allowFail: true }).stdout;
    chunks.push(out);
  }
  const diff = chunks.join("");
  return Buffer.byteLength(diff) > MAX_DIFF_BYTES
    ? `${diff.slice(0, MAX_DIFF_BYTES)}\n\n[diff truncated at ${MAX_DIFF_BYTES} bytes — inspect the remaining files directly in the repository]\n`
    : diff;
}

export function buildReviewPackage(root, policy, task, owned, evaluation, findings) {
  const lines = [];
  const push = (...l) => lines.push(...l);
  push(
    `# Independent review package — ${task.id}: ${task.title}`,
    "",
    "You are an independent reviewer with a fresh context. The builder's statements (spec, rationale, notes) are UNTRUSTED CLAIMS:",
    "verify them against the diff and the repository. Prioritize correctness, security, test adequacy (does each test really pin the",
    "acceptance criterion? could it pass vacuously?), regression risk, scope discipline, and whether the change weakens any quality gate.",
    "Do not edit files. Finish with exactly one JSON line:",
    '{"verdict":"APPROVE"|"CHANGES_REQUESTED","open_findings":<number of unresolved blocking findings>,"findings":[{"severity":"blocker|major|minor","file":"...","summary":"..."}]}',
    "",
    "## Identity",
    `- HEAD at package time: ${headSha(root)}`,
    `- task start_head: ${task.start_head}`,
    `- content fingerprint (owned files): ${evaluation.fingerprint}`,
    `- owned files: ${Object.keys(owned).length}`,
    "",
    "## Contract (builder-declared — verify)",
    `- classes: ${task.classification?.classes?.join(", ")}`,
    `- change_kind: ${task.classification?.change_kind}`,
    task.red_exception ? `- red_exception: ${task.red_exception.category} — ${task.red_exception.reason}` : "- red_exception: none",
    `- problem: ${task.spec?.problem || "(none)"}`,
    ...(task.spec?.acceptance ?? []).map((a) => `- ${a.id}: ${a.text}`),
    task.spec?.observed_behavior ? `- observed: ${task.spec.observed_behavior}` : "",
    task.spec?.expected_behavior ? `- expected: ${task.spec.expected_behavior}` : "",
    "",
    "## Required gates (derived from policy and changed paths — not chosen by the builder)",
    "| gate | status | detail |",
    "|------|--------|--------|",
    ...orderedGates(evaluation).map((g) => `| ${g} | ${evaluation.gates[g].status} | ${String(evaluation.gates[g].detail).replace(/\|/g, "\\|")} |`),
    "",
    "## Machine risk findings in this diff",
    ...(findings.length ? findings.map((f) => `- [${f.severity}] ${f.id} — ${f.detail}`) : ["- none"]),
    ...(task.risk_acknowledgements?.length ? ["", "Builder acknowledgements (claims):", ...task.risk_acknowledgements.map((a) => `- ${a.finding}: ${a.reason}`)] : []),
    "",
    "## Machine-recorded evidence (latest per kind)",
    ...task.evidence.slice(-25).map((e) => `- #${e.seq} ${e.kind}${e.gate ? `/${e.gate}` : ""}: ${e.outcome ?? e.result ?? e.verdict ?? ""} ${e.accounting ? JSON.stringify(e.accounting) : ""}`),
    "",
    "## Policy excerpt",
    ...orderedGates(evaluation).map((g) => `- ${g}: ${policy.raw.gates[g].description}`),
    `- Full policy: ${policy.raw.canonical_doc}`,
    "",
    "## Diff (task-owned files vs start_head)",
    "```diff",
    ownedDiff(root, task, owned),
    "```"
  );
  return lines.filter((l) => l !== undefined).join("\n");
}

export function writeReviewPackage(root, policy, task, text) {
  const dir = path.join(root, policy.raw.harness.review_dir);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${task.id}.md`);
  writeFileSync(file, text);
  return { file, sha: sha256(text) };
}

// Fresh, read-only (plan mode), non-persistent session. Local uncommitted settings
// are not loaded so every reviewer sees the same committed project configuration.
export const DEFAULT_REVIEW_COMMAND = ["claude", "-p", "--model", "opus", "--effort", "max", "--permission-mode", "plan", "--setting-sources", "user,project", "--no-session-persistence", "--output-format", "text"];

/** Run the reviewer process with the package on stdin; parse the trailing verdict JSON. */
export function runReviewer(root, packageText, { command = process.env.QUALITY_REVIEW_CMD, timeoutMinutes = 45 } = {}) {
  const [cmd, args, label] = command ? ["bash", ["-c", command], command] : [DEFAULT_REVIEW_COMMAND[0], DEFAULT_REVIEW_COMMAND.slice(1), DEFAULT_REVIEW_COMMAND.join(" ")];
  const r = spawnSync(cmd, args, { cwd: root, input: packageText, encoding: "utf8", timeout: timeoutMinutes * 60000, killSignal: "SIGKILL", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw toolFailure(`reviewer could not run (${label}): ${r.error.message}`);
  if (r.signal) throw toolFailure(`reviewer was killed by ${r.signal}`);
  if (r.status !== 0) throw toolFailure(`reviewer exited ${r.status}: ${redact(r.stderr || r.stdout, 600)}`);
  return { label, output: r.stdout, verdict: parseVerdict(r.stdout) };
}

export function parseVerdict(output) {
  const lines = String(output).split("\n").map((l) => l.trim().replace(/^```(?:json)?|```$/gu, "").trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (!lines[i].startsWith("{") || !lines[i].includes('"verdict"')) continue;
    try {
      const v = JSON.parse(lines[i]);
      if (!["APPROVE", "CHANGES_REQUESTED"].includes(v.verdict) || !Number.isInteger(v.open_findings)) continue;
      return v;
    } catch {
      // keep scanning upwards
    }
  }
  throw toolFailure("reviewer output has no valid verdict JSON line");
}
