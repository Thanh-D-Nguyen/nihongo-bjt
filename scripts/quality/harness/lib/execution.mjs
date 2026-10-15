// Thin CLI/native-hook adapter; local journals, not task records, carry consent.
import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { answerDecision, classifyAction, executionSummary, newDecision, questionPayload, resumeDecision, shellAction, withExecutionStore } from "./autonomy.mjs";
import { recover } from "./recovery.mjs";
import { appendEvidence, loadTask, ownedBlobs, saveTask } from "./task.mjs";
import { fingerprint } from "./git.mjs";
import { redact, sha256, toolFailure, violation } from "./util.mjs";

const argvValid = (argv) => Array.isArray(argv) && argv.length > 0 && argv.every((s) => typeof s === "string" && s.length > 0 && !s.includes("\0"));
function run(root, argv, env = process.env) {
  if (!argvValid(argv)) throw violation("continuation needs an executable argv; shell evaluation is not supported");
  const result = spawnSync(argv[0], argv.slice(1), { cwd: root, env, encoding: "utf8", timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0 || result.error) throw toolFailure(`continuation failed: ${redact(result.error?.message ?? result.stderr ?? "")}`);
  return result;
}

/** Live identity: no caller-supplied assertion can turn a stale target into consent. */
export function observeTarget(root, target) {
  let identity;
  if (target.type === "path") {
    const abs = realpathSync(path.resolve(root, target.path));
    const stat = statSync(abs);
    identity = { path: abs, device: stat.dev, inode: stat.ino, ...(stat.isFile() ? { content: sha256(readFileSync(abs)) } : {}) };
  } else if (target.type === "database") {
    if (!/^[A-Z][A-Z0-9_]*$/u.test(target.connection_env ?? "") || !process.env[target.connection_env]) throw violation("database identity requires an available connection environment reference");
    // Bind database OID, server identity and startup. A restart conservatively invalidates consent.
    const query = "SELECT json_build_array(current_database(),(SELECT oid FROM pg_database WHERE datname=current_database()),inet_server_addr(),inet_server_port(),pg_postmaster_start_time(),current_user)::text";
    identity = JSON.parse(run(root, ["psql", "--no-psqlrc", "--tuples-only", "--no-align", "--command", query], { ...process.env, PGDATABASE: process.env[target.connection_env] }).stdout.trim());
  } else throw violation("scoped execution needs a live path/database target; use native one-operation permission for other targets");
  return { ...target, identity, fingerprint: sha256(JSON.stringify(identity)) };
}

function continuationRun(root, continuation, automatic = false) {
  if (automatic) {
    const classified = shellAction((continuation.argv ?? []).join(" "));
    if (!classified || classifyAction({ raw: { autonomy: continuation.policy } }, classified).class !== "AUTO") throw violation("alternative must be an ordinary local AUTO command");
  }
  const result = run(root, continuation.argv);
  return { step: continuation.step, exit_code: result.status };
}

export async function executionCommand(ctx, task, mode, input, options = {}) {
  if (task.closed) throw violation("a CLOSED task cannot execute recovery or decisions");
  if (mode === "inspect") return observeTarget(ctx.root, input);
  if (mode === "recover") {
    if (!argvValid(input.retry?.argv)) throw violation("recovery requires the original retry argv");
    const retryAction = shellAction(input.retry.argv.join(" "));
    if (!retryAction || classifyAction(ctx.policy, retryAction).class !== "AUTO") throw violation("recovery cannot smuggle a consequential retry; request a decision instead");
    const records = [];
    const result = recover(ctx.root, ctx.policy, input, { record: (r) => {
      records.push(r);
      Object.assign(task, loadTask(ctx.root, ctx.policy, task.id));
      appendEvidence(ctx.root, task, { ...r, kind: "recovery_trace", phase: r.kind });
      saveTask(ctx.root, ctx.policy, task); // durable before effect, health and retry
    }, retry: ({ env }) => run(ctx.root, input.retry.argv, env) });
    Object.assign(task, loadTask(ctx.root, ctx.policy, task.id));
    appendEvidence(ctx.root, task, { kind: "recovery", id: randomUUID(), request: { kind: input.kind }, fingerprint: fingerprint(ownedBlobs(ctx.root, ctx.policy, task)), ...result, records });
    saveTask(ctx.root, ctx.policy, task);
    return result;
  }
  return withExecutionStore(ctx.root, ctx.policy, task.id, async (state, workspace, store) => {
    const persist = (next) => {
      store(next);
      Object.assign(task, loadTask(ctx.root, ctx.policy, task.id)); // continuation may write declarations/evidence/history
      task.execution = executionSummary(next, task.id);
      saveTask(ctx.root, ctx.policy, task);
    };
    if (mode === "request") {
      if (!argvValid(input.continuation?.argv)) throw violation("decision continuation requires argv");
      // Classification may only increase risk; a declaration cannot relabel a risky command AUTO.
      const detected = shellAction(input.continuation.argv.join(" "));
      if (detected && classifyAction(ctx.policy, detected).class === "FORBIDDEN") throw violation("FORBIDDEN continuation cannot acquire consent");
      const target = observeTarget(ctx.root, input.action.target);
      if (target.fingerprint !== input.action.target.fingerprint) throw violation("inspect the live target before requesting a decision");
      const created = newDecision(ctx.policy, state, task.id, workspace, input.action, input.continuation);
      persist(created.state);
      if (created.decision.status === "WAITING_FOR_DECISION") return { status: "WAITING_FOR_DECISION", id: created.decision.id, ...questionPayload(created.decision) };
      state = created.state;
      options.id = created.decision.id;
    } else if (mode === "answer") {
      const pending = state.decisions.find((d) => d.id === options.id);
      if (!pending) throw violation("unknown decision");
      state = answerDecision(ctx.policy, state, task.id, workspace, options.id, options.choice, options.scope, options.choice?.startsWith("approve_") ? observeTarget(ctx.root, pending.target) : pending.target);
      persist(state);
    } else if (mode !== "resume") throw violation("decision requires inspect|request|answer|resume");
    return resumeDecision({ policy: ctx.policy, state, taskId: task.id, workspace, id: options.id, persist, observeTarget: (target) => observeTarget(ctx.root, target), resume: (continuation) => continuationRun(ctx.root, continuation), alternative: (continuation) => continuation.alternative ? continuationRun(ctx.root, { ...continuation.alternative, policy: ctx.policy.raw.autonomy }, true) : { cancelled: true, continue_other_work: true, step: continuation.step } });
  });
}

// Host-native permission resumes the exact original tool call. A successful post
// event attests that one execution; it grants no reusable TASK/workspace authority.
export async function nativeDecision(ctx, task, input, action) {
  return withExecutionStore(ctx.root, ctx.policy, task.id, async (state, workspace, store) => {
    const id = input.tool_use_id;
    if (!id) throw violation("native decision requires the host's tool_use_id");
    const created = newDecision(ctx.policy, state, task.id, workspace, action, { step: `native:${id}`, native_tool_use_id: id });
    store(created.state);
    Object.assign(task, loadTask(ctx.root, ctx.policy, task.id));
    task.execution = executionSummary(created.state, task.id);
    saveTask(ctx.root, ctx.policy, task);
    return created.decision;
  });
}

export async function nativeOutcome(ctx, input) {
  return withExecutionStore(ctx.root, ctx.policy, "NATIVE-0", async (state, _workspace, store) => {
    const id = input.tool_use_id;
    const pending = state.decisions.find((d) => d.continuation.native_tool_use_id === id && d.status === "WAITING_FOR_DECISION");
    if (!pending) return;
    const failed = input.hook_event_name === "PostToolUseFailure";
    const next = { ...state, decisions: state.decisions.map((d) => d.id === pending.id ? { ...d, selected: "native_permission_once", scope: "ONCE", status: failed ? "UNKNOWN_OUTCOME" : "COMPLETED" } : d) };
    store(next);
    const task = loadTask(ctx.root, ctx.policy, pending.task);
    task.execution = executionSummary(next, task.id);
    saveTask(ctx.root, ctx.policy, task);
  });
}
