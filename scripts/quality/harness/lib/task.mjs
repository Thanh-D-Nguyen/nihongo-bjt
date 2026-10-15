// Task records: compact, durable lifecycle state committed under tasks/.
// The record holds the agent's declarations (spec, classification, targets)
// and harness-produced evidence. Gate status is never stored as truth: it is
// recomputed from evidence by evaluate() locally and again in CI.
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { changedSinceRev, dirtyPaths, fingerprint, headSha, worktreeBlobs } from "./git.mjs";
import { isTaskRecord, isVolatile, pathRule, requiredGates } from "./policy.mjs";
import { targetId, validateTarget } from "./runners.mjs";
import { localExecutionSummary, validateRecoveryBlocker } from "./autonomy.mjs";
import { nowIso, readJson, toolFailure, violation, writeJson } from "./util.mjs";

export const TASK_SCHEMA = "nihongo-task/1";
const ID_RE = /^[A-Z][A-Z0-9]*-[0-9]+$/u;

export const tasksDir = (root, policy) => path.join(root, policy.raw.harness.tasks_dir);
export const taskFile = (root, policy, id) => path.join(tasksDir(root, policy), `${id}.json`);

export function validateTaskId(id) {
  if (!ID_RE.test(id ?? "")) throw violation(`task id must look like ABC-123 (got ${JSON.stringify(id)})`);
  return id;
}

export function loadTask(root, policy, id) {
  const task = readJson(taskFile(root, policy, validateTaskId(id)), `task ${id}`);
  if (task.schema !== TASK_SCHEMA || task.id !== id) throw toolFailure(`task ${id} has an unexpected schema/id`);
  task.evidence ??= [];
  task.history ??= [];
  return task;
}

export function saveTask(root, policy, task) {
  const execution = localExecutionSummary(root, policy, task.id);
  writeJson(taskFile(root, policy, task.id), { ...task, ...(execution ? { execution } : {}) });
}

export function activeTaskId(root, policy) {
  const file = path.join(root, policy.raw.harness.active_pointer);
  return existsSync(file) ? readFileSync(file, "utf8").trim() || null : null;
}

export function setActive(root, policy, id) {
  const file = path.join(root, policy.raw.harness.active_pointer);
  mkdirSync(path.dirname(file), { recursive: true });
  if (id) writeFileSync(file, `${id}\n`);
  else rmSync(file, { force: true });
}

export function listTasks(root, policy) {
  const dir = tasksDir(root, policy);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^[A-Z][A-Z0-9]*-[0-9]+\.json$/u.test(f))
    .map((f) => f.replace(/\.json$/u, ""))
    .sort();
}

export function newTask(root, policy, id, title) {
  validateTaskId(id);
  if (existsSync(taskFile(root, policy, id))) throw violation(`task ${id} already exists`);
  if (!String(title ?? "").trim()) throw violation("a task title is required");
  const preexisting = dirtyPaths(root).filter((p) => !isTaskRecord(policy, p));
  return {
    schema: TASK_SCHEMA,
    id,
    title,
    start_head: headSha(root),
    preexisting_changes: worktreeBlobs(root, preexisting),
    spec: { problem: "", acceptance: [], expected_behavior: "", observed_behavior: "", rollback_plan: "" },
    classification: null,
    red_exception: null,
    red_targets: [],
    sensitivity: null,
    deletion: null,
    risk_acknowledgements: [],
    state: "CREATED",
    history: [{ state: "CREATED", at: nowIso(), head: headSha(root) }],
    evidence: [],
    closed: null
  };
}

/**
 * Files this task owns right now: everything changed since start_head, minus
 * task records, volatile build artifacts, and files that were already dirty
 * at `begin` — those stay someone else's even if they keep changing, unless
 * explicitly claimed (`pnpm quality claim <path>`). Committing an unclaimed
 * one is caught as UNOWNED in CI.
 */
export function ownedBlobs(root, policy, task, base = task.start_head) {
  const changed = changedSinceRev(root, base).filter((p) => !isTaskRecord(policy, p) && !isVolatile(policy, p));
  const current = worktreeBlobs(root, changed);
  const claimed = new Set(task.claimed ?? []);
  const owned = {};
  for (const p of changed) {
    if (p in (task.preexisting_changes ?? {}) && !claimed.has(p)) continue;
    owned[p] = current[p];
  }
  return owned;
}

/** Pre-existing changes explicitly claimed by the task (shown in status). */
export const claimedPreexisting = (task, owned) => Object.keys(owned).filter((p) => p in (task.preexisting_changes ?? {}));

/** Pre-existing changes that changed again since `begin` but are not claimed (shown in status). */
export function driftedPreexisting(root, task) {
  const pre = task.preexisting_changes ?? {};
  const claimed = new Set(task.claimed ?? []);
  const paths = Object.keys(pre).filter((p) => !claimed.has(p));
  const now = worktreeBlobs(root, paths);
  return paths.filter((p) => now[p] !== pre[p]);
}

export function appendEvidence(root, task, entry) {
  const seq = task.evidence.reduce((m, e) => Math.max(m, e.seq ?? 0), 0) + 1;
  const record = { seq, at: nowIso(), head: headSha(root), ...entry };
  task.evidence.push(record);
  return record;
}

const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;
const latest = (task, pred) => task.evidence.filter(pred).sort((a, b) => b.seq - a.seq)[0] ?? null;

/**
 * A sensitivity mutation must break PRODUCTION code: mutating a test (or a doc,
 * or anything outside the repo) proves nothing about the test's power.
 */
export function validateMutation(policy, mutation) {
  const problems = [];
  const file = String(mutation?.file ?? "");
  if (!file || file.startsWith("/") || file.split("/").includes("..")) problems.push(`mutation file must be a repo-relative path inside the repository (got ${JSON.stringify(file)})`);
  else {
    const rule = pathRule(policy, file);
    if (!rule.production || rule.kind === "test") problems.push(`mutation file ${file} is ${rule.kind}; a sensitivity mutation must break production code, not the test or docs`);
  }
  if (!String(mutation?.find ?? "")) problems.push("mutation.find is empty");
  // Crash injection makes any test that merely calls the code fail; it says nothing about assertions.
  const CRASH = /\b(?:panic|throw|os\.Exit|process\.exit|log\.Fatal\w*|abort)\b/u;
  if (CRASH.test(String(mutation?.replace ?? "")) && !CRASH.test(String(mutation?.find ?? ""))) problems.push("mutation must change behavior, not inject a crash (panic/throw/exit)");
  if (mutation?.find === mutation?.replace) problems.push("mutation.replace must differ from mutation.find");
  return problems;
}

export function sensitivityTargets(task) {
  return Array.isArray(task.sensitivity?.targets) ? task.sensitivity.targets : [];
}

/** Targets whose GREEN is required: red targets plus sensitivity targets. */
export function greenTargets(task) {
  const seen = new Map();
  for (const t of [...(task.red_targets ?? []), ...sensitivityTargets(task)]) seen.set(targetId(t), t);
  return [...seen.values()];
}

export function validateBlockerProtocol(policy, gate, protocol, task, fingerprint) {
  const def = policy.raw.gates[gate];
  const problems = [];
  if (!def) return [`unknown gate ${gate}`];
  if (!def.blockable) return [`gate ${gate} cannot be BLOCKED — it has no external dependency the harness accepts as a blocker`];
  if (protocol?.reproduced !== true) problems.push("reproduced must be true (re-run and observe the blocker)");
  for (const field of ["error", "workaround_attempted", "why_not_viable"]) if (!nonEmpty(protocol?.[field])) problems.push(`${field} is required`);
  const alts = Array.isArray(protocol?.alternatives) ? protocol.alternatives : [];
  for (const known of def.known_alternatives) {
    const a = alts.find((x) => x.id === known);
    if (!a) problems.push(`known alternative "${known}" was not addressed`);
    else if (typeof a.attempted !== "boolean" || !nonEmpty(a.result)) problems.push(`alternative "${known}" needs attempted:boolean and result`);
  }
  if (!alts.some((a) => a.attempted === true)) problems.push("at least one alternative must actually be attempted");
  return [...problems, ...validateRecoveryBlocker(policy, protocol, task, fingerprint)];
}

function testExists(root, policy, t) {
  if (t.runner === "go") {
    const dir = path.join(root, policy.raw.runners.go.module_dir, t.package);
    if (!existsSync(dir)) return false;
    const re = new RegExp(`^func ${t.test}\\(`, "mu");
    return readdirSync(dir).some((f) => f.endsWith("_test.go") && re.test(readFileSync(path.join(dir, f), "utf8")));
  }
  const abs = path.join(root, t.file);
  if (!existsSync(abs)) return false;
  const leaf = t.test.split(" > ").at(-1);
  return readFileSync(abs, "utf8").includes(leaf);
}

/**
 * Evaluate every required gate against the evidence.
 * ctx: { root, owned (path->blob), fingerprint, findings }
 * Returns { required, errors, gates: {gate: {status, detail}}, status, findingsProblems }.
 */
export function evaluate(policy, task, ctx) {
  const { owned } = ctx;
  const classes = task.classification?.classes ?? [];
  const exempt = new Map(policy.riskRules.filter((r) => r.exempt_classes).map((r) => [r.id, r.exempt_classes]));
  const findings = (ctx.findings ?? []).filter((f) => !(exempt.get(f.rule) ?? []).some((c) => classes.includes(c)));
  const fp = ctx.fingerprint ?? fingerprint(owned);
  const ownedPaths = Object.keys(owned);
  const { gates: required, errors } = requiredGates(policy, task, ownedPaths, findings);
  const execution = localExecutionSummary(ctx.root, policy, task.id) ?? task.execution;
  const waitingForDecision = execution?.status === "WAITING_FOR_DECISION" || execution?.decisions?.some((d) => ["WAITING_FOR_DECISION", "ANSWERED", "EXECUTING", "UNKNOWN_OUTCOME"].includes(d.status));
  if (waitingForDecision) errors.push("pending decision/uncertain execution must be resolved before closure");
  const result = {};
  const kindDef = policy.raw.change_kinds[task.classification?.change_kind] ?? {};

  for (const target of [...(task.red_targets ?? []), ...sensitivityTargets(task)]) {
    for (const p of validateTarget(target)) errors.push(p);
  }

  const gateStatus = (gate) => {
    const def = policy.raw.gates[gate];
    switch (def.type) {
      case "spec": {
        const acc = task.spec?.acceptance;
        if (!Array.isArray(acc) || !acc.length) return { status: "MISSING", detail: "spec.acceptance is empty" };
        const bad = acc.filter((a) => !nonEmpty(a?.id) || !nonEmpty(a?.text));
        if (bad.length) return { status: "INVALID", detail: "every acceptance criterion needs {id, text}" };
        const missing = (kindDef.requires_spec ?? []).filter((f) => !nonEmpty(task.spec?.[f]));
        if (missing.length) return { status: "MISSING", detail: `spec needs ${missing.join(", ")} for ${task.classification.change_kind}` };
        return { status: "PASS", detail: `${acc.length} criteria` };
      }
      case "spec_field":
        return nonEmpty(task.spec?.[def.field]) ? { status: "PASS", detail: def.field } : { status: "MISSING", detail: `spec.${def.field} is required` };
      case "red": {
        const targets = task.red_targets ?? [];
        if (!targets.length) return { status: "MISSING", detail: "no red_targets declared (pnpm quality red --go ./pkg:TestX --expect '...')" };
        const noExpect = targets.filter((t) => !nonEmpty(t.expect));
        if (noExpect.length) return { status: "INVALID", detail: `targets without "expect": ${noExpect.map(targetId).join(", ")}` };
        const missingTests = targets.filter((t) => !testExists(ctx.root, policy, t));
        if (missingTests.length) return { status: "INVALID", detail: `red target test no longer exists: ${missingTests.map(targetId).join(", ")}` };
        const lacking = [];
        for (const t of targets) {
          const id = targetId(t);
          const ok = task.evidence.some(
            (e) =>
              e.kind === "red" &&
              e.outcome === "VALID_RED" &&
              e.production_at_base === true &&
              e.targets?.some((x) => x.id === id && x.valid === true) &&
              e.expects?.[id] === t.expect
          );
          if (!ok) lacking.push(id);
        }
        if (lacking.length) return { status: "MISSING", detail: `no VALID_RED (against base production code) for: ${lacking.join(", ")}` };
        return { status: "PASS", detail: `${targets.length} target(s)` };
      }
      case "green": {
        const targets = greenTargets(task);
        if (!targets.length) return { status: "MISSING", detail: "no targets to prove GREEN" };
        const after = Math.max(0, ...task.evidence.filter((e) => e.kind === "red" && e.outcome === "VALID_RED").map((e) => e.seq));
        const ids = targets.map(targetId);
        const g = latest(task, (e) => e.kind === "green" && e.seq > after);
        if (!g) return { status: "MISSING", detail: "no GREEN run after the last VALID_RED (pnpm quality green)" };
        if (g.fingerprint !== fp) return { status: "STALE", detail: "code changed after the GREEN run — re-run" };
        const passing = new Set((g.targets ?? []).filter((x) => x.outcome === "PASS").map((x) => x.id));
        const notPassing = ids.filter((id) => !passing.has(id));
        if (notPassing.length) return { status: "FAIL", detail: `not passing in the latest GREEN run: ${notPassing.join(", ")}` };
        return { status: "PASS", detail: `${ids.length} target(s)` };
      }
      case "sensitivity": {
        const s = task.sensitivity;
        if (!s?.mutation || !sensitivityTargets(task).length) return { status: "MISSING", detail: "sensitivity {mutation:{file,find,replace}, targets} not declared" };
        const bad = validateMutation(policy, s.mutation);
        if (bad.length) return { status: "INVALID", detail: bad.join("; ") };
        const e = latest(task, (x) => x.kind === "sensitivity");
        if (!e) return { status: "MISSING", detail: "no sensitivity run (pnpm quality sensitivity)" };
        if (JSON.stringify(e.mutation) !== JSON.stringify(s.mutation)) return { status: "STALE", detail: "the declared mutation changed since the last run" };
        const noExpect = sensitivityTargets(task).filter((t) => !nonEmpty(t.expect));
        if (noExpect.length) return { status: "INVALID", detail: `sensitivity targets need "expect" (the assertion text the mutation must trigger): ${noExpect.map(targetId).join(", ")}` };
        if (sensitivityTargets(task).some((t) => e.expects?.[targetId(t)] !== t.expect)) return { status: "STALE", detail: "sensitivity expectations changed since the last run" };
        if (e.outcome !== "SENSITIVE") return { status: "FAIL", detail: `last sensitivity run: ${e.outcome}` };
        if (e.fingerprint !== fp) return { status: "STALE", detail: "code changed after the sensitivity run" };
        return { status: "PASS", detail: `${sensitivityTargets(task).length} target(s) fail under mutation` };
      }
      case "deletion": {
        const d = task.deletion;
        if (!Array.isArray(d?.symbols) || !d.symbols.length || !nonEmpty(d?.consumer_audit)) {
          return { status: "MISSING", detail: "deletion {symbols[], consumer_audit} not declared" };
        }
        const e = latest(task, (x) => x.kind === "deletion_scan");
        if (!e) return { status: "MISSING", detail: "no stale-reference scan (pnpm quality deletion)" };
        if (JSON.stringify(e.symbols) !== JSON.stringify(d.symbols)) return { status: "STALE", detail: "symbols changed since the scan" };
        if (e.fingerprint !== fp) return { status: "STALE", detail: "code changed after the scan" };
        if (e.result !== "PASS") return { status: "FAIL", detail: `${e.hits?.length ?? "?"} stale reference(s)` };
        return { status: "PASS", detail: `${d.symbols.length} symbol(s), no stale references` };
      }
      case "suite":
      case "command": {
        const e = latest(task, (x) => (x.kind === def.type || x.kind === "blocked") && x.gate === gate);
        if (!e) return { status: "MISSING", detail: def.type === "suite" ? "not run (pnpm quality verify)" : `not run (pnpm quality evidence ${gate} -- <command>)` };
        if (e.kind === "blocked") {
          if (e.fingerprint !== fp) return { status: "STALE", detail: "code changed after the blocker/recovery evidence" };
          const problems = validateBlockerProtocol(policy, gate, e.protocol, task, fp);
          if (problems.length) return { status: "INVALID", detail: `invalid BLOCKED claim: ${problems.join("; ")}` };
          return { status: "BLOCKED", detail: e.protocol.error };
        }
        if (e.fingerprint !== fp) return { status: "STALE", detail: "code changed after this run — re-run" };
        if (e.exit_code !== 0) return { status: "FAIL", detail: `exit ${e.exit_code}${e.result ? ` (${e.result})` : ""}` };
        if (def.type === "suite") {
          const a = e.accounting;
          if (e.result !== "PASS" || !a) return { status: "FAIL", detail: `no execution accounting / result ${e.result}` };
          if (!(a.executed > 0)) return { status: "FAIL", detail: "zero tests executed" };
          if (a.unexpected_skips !== 0 || a.failed_new) return { status: "FAIL", detail: `unexpected skips ${a.unexpected_skips}` };
          return { status: "PASS", detail: `executed ${a.executed}, passed ${a.passed}, skipped ${a.skipped} (expected ${a.expected_skips})` };
        }
        return { status: "PASS", detail: e.command };
      }
      case "review": {
        const e = latest(task, (x) => x.kind === "review");
        if (!e) return { status: "MISSING", detail: "no independent review (pnpm quality review prepare && pnpm quality review run)" };
        if (!["fresh_session", "human"].includes(e.mode) || !nonEmpty(e.reviewer)) return { status: "INVALID", detail: "review needs reviewer and mode fresh_session|human" };
        if (e.verdict !== "APPROVE") return { status: "FAIL", detail: `verdict ${e.verdict}` };
        if (e.open_findings !== 0) return { status: "FAIL", detail: `${e.open_findings} open finding(s)` };
        if (e.fingerprint !== fp) return { status: "STALE", detail: "code changed after the review — re-review" };
        return { status: "PASS", detail: `${e.reviewer} (${e.mode})` };
      }
      default:
        return { status: "INVALID", detail: `unknown gate type ${def.type}` };
    }
  };

  for (const gate of required.keys()) result[gate] = gateStatus(gate);

  const findingsProblems = [];
  const acks = new Map((task.risk_acknowledgements ?? []).map((a) => [a.finding, a.reason]));
  for (const f of findings) {
    if (f.severity === "forbidden") findingsProblems.push(`FORBIDDEN ${f.id} — ${f.detail}`);
    else if (f.severity === "high" && !nonEmpty(acks.get(f.id))) findingsProblems.push(`unacknowledged high-risk change ${f.id} — ${f.detail} (add {finding, reason} to risk_acknowledgements; review becomes mandatory)`);
  }

  const statuses = Object.values(result).map((g) => g.status);
  const noChanges = ownedPaths.length === 0;
  let status;
  if (errors.length || findingsProblems.length || noChanges) status = "INVALID";
  else if (statuses.every((s) => s === "PASS")) status = "VERIFIED";
  else if (statuses.every((s) => s === "PASS" || s === "BLOCKED")) status = "PARTIAL";
  else status = "INCOMPLETE";
  return { required, errors, gates: result, status, findingsProblems, noChanges, fingerprint: fp, waitingForDecision };
}

const ORDER = ["acceptance", "red", "green", "sensitivity", "deletion_audit", "rollback_analysis", "suite_harness", "suite_go", "suite_frontend", "infra_validation", "search_integration", "browser_e2e", "review"];

export function orderedGates(evaluation) {
  return Object.keys(evaluation.gates).sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
}

/** Lifecycle state derived from evidence (the stored `state` is only a readable cache). */
export function deriveState(policy, task, evaluation) {
  if (task.closed) return "CLOSED";
  if (evaluation.waitingForDecision || task.execution?.status === "WAITING_FOR_DECISION") return "WAITING_FOR_DECISION";
  const acc = task.spec?.acceptance;
  if (!Array.isArray(acc) || !acc.length) return "CREATED";
  if (!task.classification) return "SPECIFIED";
  if (evaluation.errors.length) return "CLASSIFIED";
  const g = evaluation.gates;
  const is = (gate, s) => g[gate]?.status === s;
  if (g.red && !is("red", "PASS")) return "RED_REQUIRED";
  if (g.green && !is("green", "PASS")) return g.red ? "VALID_RED" : "IMPLEMENTING";
  const pending = Object.entries(g).filter(([id, s]) => id !== "review" && !["PASS", "BLOCKED"].includes(s.status));
  if (pending.length) return g.green ? "VERIFYING" : "IMPLEMENTING";
  if (g.review && !is("review", "PASS")) return "REVIEW_REQUIRED";
  if (Object.values(g).some((s) => s.status === "BLOCKED")) return "BLOCKED";
  if (task.red_exception && is("review", "PASS")) return "EXCEPTION_APPROVED";
  return "READY_TO_CLOSE";
}

export function recordState(root, task, state) {
  if (task.state !== state) {
    task.state = state;
    task.history.push({ state, at: nowIso(), head: headSha(root) });
  }
}

/** Human/agent-readable next step for the first unsatisfied gate. */
export function nextAction(evaluation, state) {
  if (state === "WAITING_FOR_DECISION") return "Use the native interactive choices for the pending action, then resume its recorded continuation. Continue independent safe work while waiting.";
  if (state === "CREATED") return "Fill spec.acceptance (and expected/observed behavior for bugs) in the task file, then: pnpm quality spec";
  if (state === "SPECIFIED") return "pnpm quality classify <CLASS[,CLASS]> --kind <add|modify|bugfix|delete|characterization|refactor|non_behavioral>";
  if (evaluation.errors.length) return `Fix classification: ${evaluation.errors[0]}`;
  if (evaluation.findingsProblems.length) return evaluation.findingsProblems[0];
  if (evaluation.noChanges && state !== "CLOSED") return "The task owns no changes yet — implement, then follow the gates below.";
  for (const gate of orderedGates(evaluation)) {
    const s = evaluation.gates[gate];
    if (s.status !== "PASS" && s.status !== "BLOCKED") return `${gate}: ${s.detail}`;
  }
  return state === "CLOSED" ? "Task closed." : "All gates satisfied: pnpm quality close";
}

export const productionPaths = (policy, paths) => paths.filter((p) => pathRule(policy, p).production);
export const replayRevertPaths = (policy, paths) => paths.filter((p) => pathRule(policy, p).replay_revert);
