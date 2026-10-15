// Execution overlay. Quality evidence and lifecycle gates remain authoritative.
// Consent is local to this worktree; committed task summaries are never grants.
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { nowIso, redact, sha256, toolFailure, violation, writeJson } from "./util.mjs";

const nonEmpty = (value) => typeof value === "string" && value.trim().length > 0;
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const stable = (value) => JSON.stringify(canonical(value));
const secret = /\b(?:ghp|gho|ghs|github_pat|sk|xox[abp])[-_][A-Za-z0-9_-]{16,}|\beyJ[\w-]+\.[\w-]+\.[\w-]+|\bbearer\s+[\w.~+/=-]+|(?:password|passwd|api[_-]?key|secret|token)\s*[:=]\s*["']?[^\s"'$,;]+|\b(?:postgres(?:ql)?|redis|https?):\/\/[^\s/:"']+:[^\s/@"']+@/iu;
const secretFields = (value) => value && typeof value === "object" && Object.entries(value).some(([key, child]) => /^(?:password|passwd|api[_-]?key|secret|token|authorization)$/iu.test(key) && typeof child === "string" && child.length > 0 || secretFields(child));

export function classifyAction(policy, action) {
  const rules = policy.raw.autonomy;
  if (!rules) return { class: "DECISION_REQUIRED", reason: "action policy unavailable" };
  const kind = action?.kind;
  if (rules.forbidden.includes(kind) || action?.bypass_gates || action?.known_secret && action?.public_exposure) {
    return { class: "FORBIDDEN", reason: "known secret exposure, evidence destruction, or gate bypass requires a new explicit scope instruction" };
  }
  if (rules.decisions.includes(kind) || action?.privileged || action?.paid || action?.public_exposure) {
    return { class: "DECISION_REQUIRED", reason: "consequential action" };
  }
  if (!rules.auto.includes(kind)) return { class: "DECISION_REQUIRED", reason: "unknown action class" };
  const target = action.target ?? {};
  if (kind !== "read" && target.environment && target.environment !== "local") return { class: "DECISION_REQUIRED", reason: "non-local mutation" };
  if (["remove_disposable", "kill_stale_process"].includes(kind) && (!target.verified || !target.fingerprint || !target.disposable && kind === "remove_disposable" || !target.project_owned && kind === "kill_stale_process")) {
    return { class: "DECISION_REQUIRED", reason: "target ownership/disposability is unverified" };
  }
  return { class: "AUTO", reason: "ordinary local reversible execution/recovery" };
}

export function actionDigest(policy, workspace, action, continuation) {
  // Hash the original identity, never a redacted command or branch name.
  return sha256(stable({ workspace, policy: policy.raw.autonomy, action, continuation }));
}

function validateRequest(policy, action, continuation) {
  if (!nonEmpty(action?.kind) || !nonEmpty(action?.target?.id) || !nonEmpty(action?.target?.fingerprint) || !nonEmpty(action?.impact)) throw violation("action requires kind, exact target id/fingerprint, and impact");
  if (!nonEmpty(continuation?.step)) throw violation("continuation.step is required");
  if (secretFields({ action, continuation }) || secret.test(JSON.stringify({ action, continuation }))) throw violation("decision records cannot contain secrets; use environment references instead");
  if (classifyAction(policy, action).class === "FORBIDDEN") throw violation("FORBIDDEN action cannot acquire consent");
}

export function consentMatches(grant, request, taskId, workspace, policy) {
  if (grant.workspace !== workspace || grant.digest !== request.digest || grant.consumed || classifyAction(policy, request.action).class === "FORBIDDEN") return false;
  if (grant.scope === "ONCE") return grant.request_id === request.id;
  if (grant.scope === "TASK") return grant.task === taskId;
  // Deliberately bounded to the same operation AND exact target, even across tasks.
  return grant.scope === "WORKSPACE_CLASS" && grant.kind === request.action.kind;
}

export function newDecision(policy, state, taskId, workspace, action, continuation) {
  validateRequest(policy, action, continuation);
  const digest = actionDigest(policy, workspace, action, continuation);
  const effect = (d) => stable(d.continuation.argv ?? d.action.command ?? d.continuation.step);
  if (state.decisions.some((d) => ["EXECUTING", "UNKNOWN_OUTCOME"].includes(d.status) && d.target.fingerprint === action.target.fingerprint && effect(d) === stable(continuation.argv ?? action.command ?? continuation.step))) throw violation("unresolved execution requires reconciliation before a fresh request or consent reuse");
  const existing = state.decisions.find((d) => d.task === taskId && d.digest === digest && ["WAITING_FOR_DECISION", "ANSWERED"].includes(d.status));
  if (existing) return { state, decision: existing };
  const choices = [
    { id: "alternative", label: "Use the safer alternative (Recommended)", scope: "ONCE" },
    { id: "approve_once", label: "Approve once", scope: "ONCE" },
    { id: "approve_task", label: action.requested_scope === "WORKSPACE_CLASS" ? "Approve this exact target/action for this workspace" : "Approve this exact action for this task", scope: action.requested_scope === "WORKSPACE_CLASS" ? "WORKSPACE_CLASS" : "TASK" },
    { id: "cancel", label: "Cancel this operation; continue other work", scope: "ONCE" }
  ];
  const decision = { id: randomUUID(), task: taskId, action, impact: action.impact, target: action.target, digest, continuation, recommended: "alternative", choices, selected: null, scope: null, status: "WAITING_FOR_DECISION", at: nowIso() };
  const grant = state.grants.find((g) => consentMatches(g, decision, taskId, workspace, policy));
  const ready = grant ? { ...decision, selected: "approve_task", scope: grant.scope, status: "ANSWERED", grant_id: grant.id } : decision;
  return { state: { ...state, decisions: [...state.decisions, ready] }, decision: ready };
}

export function answerDecision(policy, state, taskId, workspace, id, choice, scope, observedTarget) {
  const decision = state.decisions.find((d) => d.id === id && d.task === taskId);
  if (!decision || decision.status !== "WAITING_FOR_DECISION" && !(decision.status === "ANSWERED" && ["cancel", "alternative"].includes(choice))) throw violation("no matching pending decision");
  const option = decision.choices.find((c) => c.id === choice);
  if (!option) throw violation("choose one of the recorded interactive choices");
  const approved = choice.startsWith("approve_");
  if (approved) {
    validateRequest(policy, decision.action, decision.continuation);
    if (stable(observedTarget ?? {}) !== stable(decision.target)) throw violation("target identity changed; request a new decision");
  }
  const selectedScope = scope ?? option.scope;
  if (!policy.raw.autonomy.scopes.includes(selectedScope)) throw violation("invalid consent scope");
  if (selectedScope !== option.scope) throw violation("consent scope cannot exceed the scope displayed by the selected choice");
  const grant = approved ? { id: randomUUID(), task: taskId, workspace, digest: decision.digest, kind: decision.action.kind, request_id: id, scope: selectedScope, consumed: false } : null;
  const next = { ...decision, selected: choice, scope: selectedScope, status: approved ? "ANSWERED" : "CANCELLED", grant_id: grant?.id, answered_at: nowIso() };
  return { ...state, decisions: state.decisions.map((d) => d.id === id ? next : d), grants: grant ? [...state.grants, grant] : state.grants.map((g) => g.id === decision.grant_id ? { ...g, consumed: true } : g) };
}

export function executionSummary(state, taskId) {
  const decisions = state.decisions.filter((d) => d.task === taskId).map((d) => Object.fromEntries(Object.entries(d).filter(([key]) => key !== "grant_id")));
  const waiting = decisions.some((d) => ["WAITING_FOR_DECISION", "ANSWERED", "EXECUTING", "UNKNOWN_OUTCOME"].includes(d.status));
  return { status: waiting ? "WAITING_FOR_DECISION" : "RUNNING", decisions };
}

export function localExecutionSummary(root, policy, taskId) {
  if (!/^[A-Z][A-Z0-9]*-[0-9]+$/u.test(taskId ?? "")) return null;
  const file = path.join(root, policy.raw.harness.logs_dir, "autonomy", "workspace.json");
  if (!existsSync(file)) return null;
  const state = JSON.parse(readFileSync(file, "utf8"));
  if (state.workspace !== realpathSync(root)) throw violation("execution journal belongs to another worktree");
  return executionSummary(state, taskId);
}

export function questionPayload(decision) {
  return { questions: [{ header: "Decision", question: `${decision.action.kind}: ${decision.target.id}\nTarget: ${stable(decision.target)}\nImpact: ${decision.impact}\nOperation: ${decision.continuation.argv ? stable(decision.continuation.argv) : decision.action.command ?? decision.continuation.step}`, multiSelect: false, options: decision.choices.map((c) => ({ label: c.label, description: c.id === "alternative" ? "Preserve data and try a safe alternative." : c.id === "cancel" ? "Cancel only this operation and continue independent work." : `Approve the displayed operation with ${c.scope} scope.` })) }] };
}

/** Provider/client independent: no UI means durable WAITING, never approval. */
export async function brokerDecision({ policy, state, taskId, workspace, action, continuation, providers = {}, persist, observeTarget, resume, alternative }) {
  const created = newDecision(policy, state, taskId, workspace, action, continuation);
  let next = created.state;
  const decision = created.decision;
  await persist(next);
  if (decision.status === "WAITING_FOR_DECISION") {
    let answer;
    let transport;
    for (const name of ["question", "permission", "structured"]) {
      if (typeof providers[name] !== "function") continue;
      try { answer = await providers[name](questionPayload(decision)); }
      catch (error) {
        if (error.code === "DECISION_TRANSPORT_UNAVAILABLE" || /^(?:UI|question|permission|decision transport) unavailable$/iu.test(error.message)) continue;
        return { state: next, status: "WAITING_FOR_DECISION", request: questionPayload(decision) };
      }
      if (answer?.unavailable === true) continue;
      transport = name;
      break; // a denial/non-answer never approval-shops to another transport
    }
    if (!answer) return { state: next, status: "WAITING_FOR_DECISION", request: questionPayload(decision) };
    if (!transport) return { state: next, status: "WAITING_FOR_DECISION", request: questionPayload(decision) };
    // A permission UI can authorize only the one operation it displayed.
    const scope = transport === "permission" ? "ONCE" : answer.scope;
    try {
      next = answerDecision(policy, next, taskId, workspace, decision.id, transport === "permission" && answer.choice?.startsWith("approve_") ? "approve_once" : answer.choice, scope, answer.choice?.startsWith("approve_") ? await observeTarget(decision.target) : decision.target);
    } catch (error) { return { state: next, status: "WAITING_FOR_DECISION", request: questionPayload(decision), error: redact(error.message) }; }
    await persist(next);
  }
  return resumeDecision({ policy, state: next, taskId, workspace, id: decision.id, persist, observeTarget, resume, alternative });
}

export async function resumeDecision({ policy, state, taskId, workspace, id, persist, observeTarget, resume, alternative }) {
  const decision = state.decisions.find((d) => d.id === id && d.task === taskId);
  if (!decision) throw violation("unknown decision");
  if (decision.status === "COMPLETED") return { state, status: "RUNNING", result: { step: decision.continuation.step, already_completed: true } };
  if (decision.status === "CANCELLED") {
    let next = { ...state, decisions: state.decisions.map((d) => d.id === id ? { ...d, status: "EXECUTING", execution: "alternative" } : d) };
    await persist(next);
    try {
      const result = alternative ? await alternative(decision.continuation) : { step: decision.continuation.step, cancelled: true, continue_other_work: true };
      next = { ...next, decisions: next.decisions.map((d) => d.id === id ? { ...d, status: "COMPLETED" } : d) };
      await persist(next);
      return { state: next, status: "RUNNING", result };
    } catch (error) {
      await persist({ ...next, decisions: next.decisions.map((d) => d.id === id ? { ...d, status: "UNKNOWN_OUTCOME", error: redact(error.message) } : d) });
      throw error;
    }
  }
  if (decision.status !== "ANSWERED") throw violation("decision is not ready; uncertain outcomes require reconciliation before retry");
  validateRequest(policy, decision.action, decision.continuation);
  if (actionDigest(policy, workspace, decision.action, decision.continuation) !== decision.digest || stable(await observeTarget(decision.target)) !== stable(decision.target)) throw violation("action/policy/target identity changed; approval is stale");
  const grant = state.grants.find((g) => g.id === decision.grant_id && consentMatches(g, decision, taskId, workspace, policy));
  if (!grant) throw violation("no valid local scoped authorization");
  let next = { ...state, grants: state.grants.map((g) => g.id === grant.id && g.scope === "ONCE" ? { ...g, consumed: true } : g), decisions: state.decisions.map((d) => d.id === id ? { ...d, status: "EXECUTING" } : d) };
  await persist(next); // consume ONCE durably BEFORE the effect
  try {
    const result = await resume(decision.continuation);
    next = { ...next, decisions: next.decisions.map((d) => d.id === id ? { ...d, status: "COMPLETED" } : d) };
    await persist(next);
    return { state: next, status: "RUNNING", result };
  } catch (error) {
    next = { ...next, decisions: next.decisions.map((d) => d.id === id ? { ...d, status: "UNKNOWN_OUTCOME", error: redact(error.message) } : d) };
    await persist(next);
    throw error;
  }
}

/** Serialize request/consumption. A stale lock is recovery data, never silently deleted. */
export async function withExecutionStore(root, policy, taskId, operation) {
  const dir = path.join(root, policy.raw.harness.logs_dir, "autonomy");
  mkdirSync(dir, { recursive: true });
  // ponytail: one worktree lock serializes consent effects; use per-target locks
  // only when genuinely parallel approved effects are needed.
  const lock = path.join(dir, "workspace.lock");
  let fd;
  try { fd = openSync(lock, "wx", 0o600); } catch { throw toolFailure("execution lock exists; inspect durable execution state before reconciling an uncertain operation"); }
  writeFileSync(fd, JSON.stringify({ pid: process.pid, at: nowIso() }));
  const file = path.join(dir, "workspace.json");
  try {
    const state = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { workspace: realpathSync(root), nonce: randomUUID(), decisions: [], grants: [] };
    if (state.workspace !== realpathSync(root)) throw violation("consent journal belongs to another worktree");
    const workspace = `${state.workspace}:${state.nonce}`;
    const persist = (next) => writeJson(file, next);
    return await operation(state, workspace, persist, taskId);
  } finally { closeSync(fd); unlinkSync(lock); }
}

/** Obvious high-risk shell classes; arbitrary programs still require model policy. */
export function shellAction(command) {
  const target = { id: "shell operation", fingerprint: sha256(command), environment: "local" };
  const action = (kind, impact) => ({ kind, target, impact, command });
  if (secret.test(command) && /\b(?:git\s+push|curl|wget|publish|upload)\b/u.test(command)) return { ...action("expose_known_secret", "Public or external secret disclosure"), known_secret: true, public_exposure: true };
  if (/QUALITY_GUARD\s*=\s*off|(?:LEFTHOOK|HUSKY)\s*=\s*0|--no-verify|continue-on-error\s*:\s*true/u.test(command)) return action("bypass_gates", "Disable an engineering/security gate");
  if (/\b(?:rm|git\s+rm)\b[^;&]*\btasks\/(?:\.logs|\.review|[A-Z][A-Z0-9]*-\d+\.json)/u.test(command)) return action("delete_unverified_evidence", "Delete durable task/recovery evidence without verified preservation");
  if (/\b(?:sudo|doas)\s|chmod\s+[^;&]*777|curl[^;&|]*\|\s*(?:sh|bash)/u.test(command)) return action("privileged_configuration", "Privileged or untrusted installation/configuration");
  if (/git\s+push\b[^;&]*(?:--force(?:-with-lease)?|-f\b)|git\s+(?:reset\s+--hard|clean\s+-[a-zA-Z]*f)/u.test(command)) return action("history_rewrite", "Rewrite history or discard unverified workspace data");
  if (/docker\s+(?:compose\b[^;&]*\bdown\b[^;&]*(?:-v\b|--volumes)|volume\s+rm|system\s+prune[^;&]*--volumes)|\b(?:DROP\s+(?:DATABASE|SCHEMA|TABLE)|TRUNCATE\s+(?:TABLE\s+)?\w+)\b|\brm\s+[^;&]*-(?:[a-zA-Z]*[rf])\b|\b(?:redis-cli\b[^;&]*FLUSH(?:ALL|DB))\b/iu.test(command)) return action("delete_persistent_data", "Destroy potentially persistent data");
  if (/\b(?:ssh|scp|rsync|gcloud|kubectl|terraform\s+apply|gh\s+(?:pr\s+merge|release\s+create))\b|\bdocker\s+[^;&]*(?:--context|--host|-H\b)|\bDOCKER_(?:HOST|CONTEXT)=/u.test(command)) return action("external_mutation", "External account/service action; verify scope and identity");
  if (/\bgit\s+push\b|\b(?:npm|pnpm|yarn|uv)\b[^;&]*\b(?:publish|deploy)\b|\bcurl\b[^;&]*(?:-X\s*(?:POST|PUT|PATCH|DELETE)|--request[=\s]+(?:POST|PUT|PATCH|DELETE)|--(?:data|form|upload-file)|\s-[dFT]\b)|\bwget\b[^;&]*--(?:post|method)/iu.test(command)) return action("external_mutation", "Publish or mutate an external service/account");
  if (/\b(?:--host|--bind|--listen)[=\s]+0\.0\.0\.0|\b(?:ngrok|cloudflared\s+tunnel)\b/u.test(command)) return action("public_exposure", "Expose a local service publicly");
  if (/^\s*(?:bash\s+)?scripts\/quality\/(?:verify-(?:go|frontend|harness|all)\.sh|with-test-db\.sh\s+(?:bash\s+)?scripts\/quality\/verify-(?:go|all)\.sh)\s*$/u.test(command)) return action("test", "Canonical local quality verification with disposable infrastructure");
  if (/^(?:\s*(?:rtk\s+(?:proxy\s+)?|env\s+))*\s*(?:pnpm|npm|go|uv|brew|docker|colima|open|node|python3?|git|rg|ls|cat|pwd|curl)\b/u.test(command) && !/[;&|`]|\$\(/u.test(command)) return action("local_development", "Local development, installation, diagnosis, or recovery");
  return null;
}

/** BLOCKED needs fresh executed recovery evidence, not a persuasive narrative. */
export function validateRecoveryBlocker(policy, protocol, task, fingerprint) {
  const rules = policy.raw.autonomy;
  const problems = [];
  if (!rules) return ["autonomy policy unavailable"];
  if (rules.recoverable.includes(protocol?.remaining?.kind) || /docker.*(?:stopped|not running)|missing (?:cli|history)|service.*stopped/iu.test(protocol?.error ?? "")) problems.push("recoverable local problems require recovery, not BLOCKED");
  if (!rules.external_blockers.includes(protocol?.remaining?.kind) || !nonEmpty(protocol?.capability_required)) problems.push("exact irrecoverable external blocker and human/external capability_required are required");
  if (task?.execution?.status === "WAITING_FOR_DECISION") problems.push("a pending decision is WAITING_FOR_DECISION, never BLOCKED");
  const ids = protocol?.recovery_ids;
  if (!Array.isArray(ids) || !ids.length) return [...problems, "recovery_ids must reference executed recovery evidence"];
  const records = ids.map((id) => task?.evidence?.find((e) => e.kind === "recovery" && e.id === id));
  if (records.some((e) => !e || e.fingerprint !== fingerprint || e.outcome !== "EXHAUSTED")) problems.push("recovery evidence is missing, stale, or not exhausted");
  const attempts = records.flatMap((e) => e?.attempts ?? []);
  const failed = attempts.filter((a) => Number.isInteger(a.exit_code) && Number.isInteger(a.verification_exit) && (a.exit_code !== 0 || a.verification_exit !== 0));
  if (failed.length < rules.minimum_failed_attempts || new Set(failed.map((a) => a.recipe)).size < 2) problems.push("at least two distinct executed failed recovery paths are required; first failure is never BLOCKED");
  return problems;
}
