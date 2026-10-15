// Lifecycle check: the merge-readiness decision for a commit range. CI runs it
// on every PR/push; locally `pnpm quality check` runs it on the working tree.
// It trusts nothing written by the builder that it can recompute: classes are
// forced by paths, gates are derived from policy, evidence must match the
// content actually being merged, risk findings come from the real diff.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { blobsAt, changedBetween, changedSinceRev, fingerprint, showFile, worktreeBlobs } from "./git.mjs";
import { checkInvariants } from "./invariants.mjs";
import { isTaskRecord, needsTask } from "./policy.mjs";
import { staleReferences } from "./deletion.mjs";
import { scanDiff } from "./diffscan.mjs";
import { TASK_SCHEMA, evaluate, orderedGates } from "./task.mjs";

const WORKTREE = "WORKTREE";

function readTaskAt(root, head, file) {
  const text = head === WORKTREE ? (existsSync(path.join(root, file)) ? readFileSync(path.join(root, file), "utf8") : null) : showFile(root, head, file);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return { __parseError: error.message };
  }
}

/**
 * @returns {{ problems: string[], notes: string[], tasks: object[], diff: string[] }}
 */
export function lifecycleCheck(root, policy, { base, head = WORKTREE, acceptPartial = false }) {
  const problems = [];
  const notes = [];
  const tasks = [];

  for (const inv of checkInvariants(root)) problems.push(`[invariant ${inv.id}] ${inv.message}`);

  const diff = head === WORKTREE ? changedSinceRev(root, base) : changedBetween(root, base, head);
  const headBlobs = (paths) => (head === WORKTREE ? worktreeBlobs(root, paths) : blobsAt(root, head, paths));
  const taskRecords = diff.filter((p) => isTaskRecord(policy, p) && /^tasks\/[A-Z][A-Z0-9]*-[0-9]+\.json$/u.test(p));
  const needing = diff.filter((p) => needsTask(policy, p));
  const owned = new Set();
  const diffSet = new Set(diff);
  const recorded = taskRecords.map((file) => ({ file, task: readTaskAt(root, head, file) }));
  // A file is fresh if ANY closed task in the range verified its merged content
  // (sequential tasks in one PR may touch the same file).
  const closedFiles = recorded.filter(({ task }) => task?.closed?.files).map(({ task }) => task.closed.files);
  const allInRange = [...new Set(closedFiles.flatMap((f) => Object.keys(f)))].filter((p) => diffSet.has(p));
  const merged = headBlobs(allInRange);
  const verifiedSomewhere = (p) => closedFiles.some((f) => p in f && f[p] === merged[p]);

  for (const { file, task } of recorded) {
    if (task === null) {
      notes.push(`${file} deleted in this range`);
      continue;
    }
    const label = file.replace(/^tasks\//u, "").replace(/\.json$/u, "");
    if (task.__parseError) {
      problems.push(`[${label}] task record is not valid JSON: ${task.__parseError}`);
      continue;
    }
    if (task.schema !== TASK_SCHEMA || task.id !== label) {
      problems.push(`[${label}] task record has an unexpected schema or id`);
      continue;
    }
    task.evidence ??= [];
    if (!task.closed || task.state !== "CLOSED") {
      problems.push(`[${label}] task is not CLOSED (state ${task.state}) — a merge-ready change needs a closed task (pnpm quality close)`);
      continue;
    }
    const files = task.closed.files ?? {};
    for (const p of Object.keys(files)) owned.add(p);
    if (fingerprint(files) !== task.closed.fingerprint) {
      problems.push(`[${label}] closed.fingerprint does not match closed.files (record edited by hand?)`);
      continue;
    }
    const inRange = Object.keys(files).filter((p) => diffSet.has(p));
    const stale = inRange.filter((p) => !verifiedSomewhere(p));
    if (stale.length) {
      problems.push(`[${label}] STALE: ${stale.length} file(s) changed after the task was verified/closed: ${stale.slice(0, 10).join(", ")} — re-run the gates and pnpm quality close`);
    }
    const findings = scanDiff(root, policy, base, head === WORKTREE ? null : head, inRange);
    const evaluation = evaluate(policy, task, { root, owned: files, fingerprint: task.closed.fingerprint, findings });
    for (const e of evaluation.errors) problems.push(`[${label}] ${e}`);
    if (evaluation.noChanges) problems.push(`[${label}] closed task owns no files`);
    for (const f of evaluation.findingsProblems) problems.push(`[${label}] ${f}`);
    for (const gate of orderedGates(evaluation)) {
      const s = evaluation.gates[gate];
      if (!["PASS", "BLOCKED"].includes(s.status)) problems.push(`[${label}] gate ${gate}: ${s.status} — ${s.detail}`);
    }
    if (["VERIFIED", "PARTIAL"].includes(evaluation.status) && task.closed.status !== evaluation.status) {
      problems.push(`[${label}] closed.status ${task.closed.status} but evidence supports ${evaluation.status} (a BLOCKED gate cannot be reported as VERIFIED)`);
    }
    if (evaluation.gates.deletion_audit) {
      // Recomputed on the merged tree; recorded scan evidence is not trusted.
      const hits = staleReferences(root, policy, task.deletion, head === WORKTREE ? null : head);
      if (hits.length) problems.push(`[${label}] deletion_audit recomputed: ${hits.length} stale reference(s), e.g. ${hits.slice(0, 3).map((h) => `${h.path}:${h.line} (${h.symbol})`).join(", ")}`);
    }
    if (evaluation.status === "PARTIAL") {
      const blocked = Object.entries(evaluation.gates).filter(([, s]) => s.status === "BLOCKED").map(([g]) => g);
      const msg = `[${label}] PARTIAL — BLOCKED gate(s): ${blocked.join(", ")} (not VERIFIED)`;
      if (policy.raw.merge_policy?.partial_requires_acceptance && !acceptPartial) {
        problems.push(`${msg}; merging a PARTIAL task needs explicit acceptance (${policy.raw.merge_policy.partial_acceptance_env}=true, PR label quality:accept-partial)`);
      } else notes.push(`${msg}; accepted`);
    }
    const attested = Object.keys(evaluation.gates).filter((g) => policy.raw.gates[g].attested || evaluation.gates[g].status === "BLOCKED");
    tasks.push({ id: label, task, status: evaluation.status, gates: evaluation.gates, attested });
  }

  const unowned = needing.filter((p) => !owned.has(p));
  if (unowned.length) {
    problems.push(
      `UNOWNED: ${unowned.length} changed file(s) are not covered by any closed task in this range: ${unowned.slice(0, 15).join(", ")}${unowned.length > 15 ? ", …" : ""}`
    );
  }

  // Forbidden patterns fail wherever they appear (also in files no task owns).
  for (const f of scanDiff(root, policy, base, head === WORKTREE ? null : head, diff.filter((p) => !isTaskRecord(policy, p)))) {
    if (f.severity === "forbidden") problems.push(`FORBIDDEN ${f.id} — ${f.detail}`);
  }
  return { problems: [...new Set(problems)], notes, tasks, diff };
}
