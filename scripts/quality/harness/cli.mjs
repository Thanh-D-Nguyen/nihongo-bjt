#!/usr/bin/env node
// Engineering lifecycle harness — the canonical command surface.
//
//   pnpm quality begin <ID-123> "<title>"      start a task (records START_HEAD + pre-existing changes)
//   pnpm quality spec [--acceptance "..."]...  record/validate the acceptance contract
//   pnpm quality classify <CLASS[,..]> --kind <kind> [--red-exception <cat> --reason "..."]
//   pnpm quality red --go ./pkg:TestX --expect "..." | --vitest <file>::"<suite > test>" --expect "..."
//   pnpm quality green                         targets pass on the implementation
//   pnpm quality sensitivity --file F --find S --replace R --go ./pkg:TestX
//   pnpm quality deletion --symbol X --audit "consumers checked: ..."
//   pnpm quality verify [--suite suite_go]     required suites with execution accounting
//   pnpm quality evidence <gate> -- <command>  record a command gate (e2e, infra validation)
//   pnpm quality block <gate> --protocol f.json   BLOCKED with the blocker protocol
//   pnpm quality recover --request f.json        repair, verify, retry the original command
//   pnpm quality decision inspect|request --input f.json
//   pnpm quality decision answer|resume --id ID --choice approve_once|approve_task|alternative|cancel [--scope SCOPE]
//   pnpm quality review prepare|run|record     independent review
//   pnpm quality claim <path> | disown <path> --reason "..."   own a pre-existing change / hand a file back
//   pnpm quality status | close | report      report = claim -> evidence table for final summaries
//   pnpm quality check [--ci --base <sha> --head <sha>]   merge-readiness lifecycle check (CI)
//   pnpm quality replay [--ci --base <sha> --head <sha>]  RED/GREEN/sensitivity replay (CI)
//   pnpm quality invariants | self-test | guard <path> | install-hooks --yes
//
// Exit codes: 0 PASS · 1 VIOLATION · 2 TOOL_FAILURE. Policy: docs/engineering/ENGINEERING_POLICY.md §16.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { lifecycleCheck } from "./lib/check.mjs";
import { scanDiff } from "./lib/diffscan.mjs";
import { commitExists, fingerprint, git, headSha, resolveCommit, snapshotWorktree, toplevel, withScratchWorktree } from "./lib/git.mjs";
import { staleReferences } from "./lib/deletion.mjs";
import { decidePath } from "./lib/guard.mjs";
import { checkInvariants } from "./lib/invariants.mjs";
import { loadPolicy, pathRule, redRequired, requiredGates } from "./lib/policy.mjs";
import { loadContextPolicy, resolveContextPolicy, checkRuntimeSync } from "./lib/context-policy.mjs";
import { applyMutation, replayAll, revertToBase } from "./lib/replay.mjs";
import { buildReviewPackage, parseVerdict, runReviewer, writeReviewPackage } from "./lib/review.mjs";
import { judgeGreen, judgeRed, runTargets, targetId, validateTarget } from "./lib/runners.mjs";
import { runSelfTest } from "./lib/selftest.mjs";
import { writeSuiteSummary } from "./lib/summary.mjs";
import { executionCommand } from "./lib/execution.mjs";
import {
  activeTaskId,
  appendEvidence,
  claimedPreexisting,
  deriveState,
  driftedPreexisting,
  evaluate,
  greenTargets,
  listTasks,
  loadTask,
  newTask,
  nextAction,
  orderedGates,
  ownedBlobs,
  recordState,
  replayRevertPaths,
  saveTask,
  sensitivityTargets,
  setActive,
  validateBlockerProtocol,
  validateMutation
} from "./lib/task.mjs";
import { EXIT, HarnessError, redact, readJson, sha256, toolFailure, violation } from "./lib/util.mjs";

// ------------------------------------------------------------------ args

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  const ordered = [];
  let rest = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--") {
      rest = argv.slice(i + 1);
      break;
    }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      const key = eq === -1 ? a.slice(2) : a.slice(2, eq);
      let value = eq === -1 ? undefined : a.slice(eq + 1);
      if (value === undefined) value = argv[i + 1] !== undefined && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      (flags[key] ??= []).push(value);
      ordered.push([key, value]);
    } else {
      positional.push(a);
    }
  }
  return { positional, flags, ordered, rest };
}

const flag = (args, key) => args.flags[key]?.at(-1);
const flagList = (args, key) => (args.flags[key] ?? []).filter((v) => v !== true);

/** --go ./pkg:TestX / --vitest file::name, each optionally followed by --expect "...". */
export function parseTargets(ordered) {
  const targets = [];
  for (const [key, value] of ordered) {
    if (key === "go") {
      const i = String(value).lastIndexOf(":");
      if (i <= 0) throw violation(`--go expects ./pkg:TestName (got ${value})`);
      targets.push({ runner: "go", package: value.slice(0, i), test: value.slice(i + 1) });
    } else if (key === "vitest") {
      const i = String(value).indexOf("::");
      if (i <= 0) throw violation(`--vitest expects <file>::<suite > test> (got ${value})`);
      targets.push({ runner: "vitest", file: value.slice(0, i), test: value.slice(i + 2) });
    } else if (key === "expect") {
      if (!targets.length) throw violation("--expect must follow a --go/--vitest target");
      targets.at(-1).expect = String(value);
    }
  }
  return targets;
}

function mergeTargets(existing, added) {
  const map = new Map((existing ?? []).map((t) => [targetId(t), t]));
  for (const t of added) map.set(targetId(t), { ...map.get(targetId(t)), ...t });
  return [...map.values()];
}

// ------------------------------------------------------------------ context

function context() {
  const root = toplevel(process.cwd());
  return { root, policy: loadPolicy(root) };
}

function currentTask(ctx, args) {
  const id = flag(args, "task") ?? activeTaskId(ctx.root, ctx.policy);
  if (!id) throw violation("no active task — pnpm quality begin <ID-123> \"<title>\" (or --task <ID>)");
  return loadTask(ctx.root, ctx.policy, id);
}

function localEvaluation(ctx, task) {
  const owned = ownedBlobs(ctx.root, ctx.policy, task);
  const findings = scanDiff(ctx.root, ctx.policy, task.start_head, null, Object.keys(owned));
  const evaluation = evaluate(ctx.policy, task, { root: ctx.root, owned, findings });
  return { owned, findings, evaluation };
}

function persist(ctx, task) {
  const { evaluation } = localEvaluation(ctx, task);
  recordState(ctx.root, task, deriveState(ctx.policy, task, evaluation));
  saveTask(ctx.root, ctx.policy, task);
  return evaluation;
}

const short = (sha) => String(sha ?? "").slice(0, 12);

function printStatus(ctx, task) {
  const { owned, findings, evaluation } = localEvaluation(ctx, task);
  const state = deriveState(ctx.policy, task, evaluation);
  const c = task.classification;
  console.log(`TASK ${task.id} — ${task.title}`);
  console.log(`state: ${state}   verification: ${task.closed ? task.closed.status : evaluation.status}`);
  console.log(`start_head: ${short(task.start_head)}   HEAD: ${short(headSha(ctx.root))}   fingerprint: ${short(evaluation.fingerprint)}`);
  console.log(`classes: ${c ? `${c.classes.join(", ")} (kind ${c.change_kind}${task.red_exception ? `, red_exception ${task.red_exception.category}` : ""})` : "(not classified)"}`);
  const byKind = {};
  for (const p of Object.keys(owned)) byKind[pathRule(ctx.policy, p).kind] = (byKind[pathRule(ctx.policy, p).kind] ?? 0) + 1;
  const claimed = claimedPreexisting(task, owned);
  console.log(`owned files: ${Object.keys(owned).length}   pre-existing (not owned): ${Object.keys(task.preexisting_changes ?? {}).length - claimed.length}${claimed.length ? `   claimed pre-existing: ${claimed.join(", ")}` : ""}`);
  const drifted = driftedPreexisting(ctx.root, task);
  if (drifted.length) console.log(`  note: pre-existing change(s) modified since begin, NOT owned (pnpm quality claim <path> if this task changed them): ${drifted.join(", ")}`);
  if (Object.keys(byKind).length) console.log(`changed by kind: ${Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(", ")}`);
  for (const d of task.execution?.decisions ?? []) if (["WAITING_FOR_DECISION", "ANSWERED", "EXECUTING", "UNKNOWN_OUTCOME"].includes(d.status)) console.log(`  decision ${d.id}: ${d.status}, ${d.action.kind}, ${d.target.id}, step ${d.continuation.step}; choices: ${d.choices.map((c) => `${c.id} (${c.scope})`).join(", ")}`);
  if (orderedGates(evaluation).length) {
    console.log("gates:");
    for (const g of orderedGates(evaluation)) console.log(`  ${g.padEnd(20)} ${evaluation.gates[g].status.padEnd(9)} ${evaluation.gates[g].detail}`);
  }
  for (const e of evaluation.errors) console.log(`  ! ${e}`);
  if (evaluation.noChanges) console.log("  ! task owns no changes");
  for (const f of findings) console.log(`  risk [${f.severity}] ${f.id} — ${f.detail}`);
  for (const p of evaluation.findingsProblems) console.log(`  ! ${p}`);
  console.log(`next: ${nextAction(evaluation, state)}`);
  return evaluation;
}

function annotate(level, message) {
  if (process.env.GITHUB_ACTIONS) console.log(`::${level} title=lifecycle::${message.replace(/\n/g, " ")}`);
}

function stepSummary(lines) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
}

// ------------------------------------------------------------------ commands

const commands = {
  async recover(ctx, args) {
    const task = currentTask(ctx, args);
    const file = flag(args, "request");
    if (!file || file === true) throw violation("usage: pnpm quality recover --request <file.json>");
    const result = await executionCommand(ctx, task, "recover", readJson(path.resolve(ctx.root, file)));
    persist(ctx, task);
    console.log(JSON.stringify(result, null, 2));
    if (result.outcome === "EXHAUSTED") throw violation("local recovery exhausted; diagnose alternatives. This is not a BLOCKED claim.");
  },

  async decision(ctx, args) {
    const task = currentTask(ctx, args);
    const mode = args.positional[0];
    const file = flag(args, "input");
    const input = file && file !== true ? readJson(path.resolve(ctx.root, file)) : null;
    const result = await executionCommand(ctx, task, mode, input, { id: flag(args, "id"), choice: flag(args, "choice"), scope: flag(args, "scope") });
    persist(ctx, task);
    console.log(JSON.stringify(result, null, 2));
  },

  begin(ctx, args) {
    const [id, ...titleParts] = args.positional;
    const active = activeTaskId(ctx.root, ctx.policy);
    if (active && active !== id && !flag(args, "switch")) {
      const t = loadTask(ctx.root, ctx.policy, active);
      if (!t.closed) throw violation(`task ${active} is still open; close it or pass --switch`);
    }
    const task = newTask(ctx.root, ctx.policy, id, titleParts.join(" "));
    const start = flag(args, "start-head");
    if (start) {
      task.start_head = resolveCommit(ctx.root, start);
      task.history[0].head = task.start_head;
    }
    const pre = flagList(args, "preexisting");
    if (pre.length) {
      // Adoption: declare exactly which uncommitted changes are someone else's.
      const blobs = {};
      for (const p of pre) blobs[p] = existsSync(path.join(ctx.root, p)) ? git(ctx.root, ["hash-object", p]).stdout.trim() : null;
      task.preexisting_changes = blobs;
    }
    saveTask(ctx.root, ctx.policy, task);
    setActive(ctx.root, ctx.policy, id);
    console.log(`Task ${id} created (start_head ${short(task.start_head)}, ${Object.keys(task.preexisting_changes).length} pre-existing change(s) not owned).`);
    console.log(`Next: fill spec in tasks/${id}.json or run: pnpm quality spec --acceptance "..."`);
  },

  spec(ctx, args) {
    const task = currentTask(ctx, args);
    for (const [k, field] of [["problem", "problem"], ["expected", "expected_behavior"], ["observed", "observed_behavior"], ["rollback", "rollback_plan"]]) {
      if (flag(args, k) !== undefined) task.spec[field] = String(flag(args, k));
    }
    for (const text of flagList(args, "acceptance")) {
      task.spec.acceptance.push({ id: `AC${task.spec.acceptance.length + 1}`, text: String(text) });
    }
    if (!task.spec.acceptance.length) throw violation(`spec.acceptance is empty — add criteria (pnpm quality spec --acceptance "...") or edit tasks/${task.id}.json`);
    const evaluation = persist(ctx, task);
    console.log(`Spec recorded: ${task.spec.acceptance.length} acceptance criteria. State ${task.state}.`);
    console.log(`next: ${nextAction(evaluation, task.state)}`);
  },

  classify(ctx, args) {
    const task = currentTask(ctx, args);
    if (!task.spec.acceptance.length) throw violation("specify before classifying (pnpm quality spec)");
    const classes = args.positional.flatMap((p) => p.split(",")).map((s) => s.trim()).filter(Boolean);
    const kind = flag(args, "kind");
    if (!classes.length || !kind || kind === true) throw violation("usage: pnpm quality classify <CLASS[,CLASS]> --kind <kind>");
    const candidate = { ...task, classification: { classes, change_kind: kind, rationale: String(flag(args, "rationale") ?? task.classification?.rationale ?? "") } };
    const exception = flag(args, "red-exception");
    if (exception) candidate.red_exception = { category: String(exception), reason: String(flag(args, "reason") ?? ""), declared_before_red: true };
    else if (flag(args, "no-red-exception")) candidate.red_exception = null;
    const { gates, errors } = requiredGates(ctx.policy, candidate, []);
    if (errors.length) throw violation(`classification rejected:\n  - ${errors.join("\n  - ")}`);
    Object.assign(task, { classification: candidate.classification, red_exception: candidate.red_exception });
    const evaluation = persist(ctx, task);
    console.log(`Classified ${classes.join(", ")} / ${kind}. Base gates: ${[...gates.keys()].join(", ")} (+ suites/review derived from changed paths).`);
    console.log(`next: ${nextAction(evaluation, task.state)}`);
  },

  red(ctx, args) {
    const task = currentTask(ctx, args);
    if (!task.classification) throw violation("classify before RED");
    if (!redRequired(ctx.policy, task)) {
      throw violation(`RED is not part of this task's lifecycle (kind ${task.classification.change_kind}${task.red_exception ? `, red_exception ${task.red_exception.category}` : ""}). Characterization/new components use: pnpm quality sensitivity`);
    }
    task.red_targets = mergeTargets(task.red_targets, parseTargets(args.ordered));
    const problems = task.red_targets.flatMap((t) => validateTarget(t, { requireExpect: true }));
    if (!task.red_targets.length) problems.push("no red targets (--go ./pkg:TestX --expect '...')");
    if (problems.length) throw violation(problems.join("; "));

    const owned = ownedBlobs(ctx.root, ctx.policy, task);
    const revert = replayRevertPaths(ctx.policy, Object.keys(owned));
    const expects = Object.fromEntries(task.red_targets.map((t) => [targetId(t), t.expect]));
    let run;
    let mode;
    try {
      if (!revert.length) {
        mode = "in_place";
        run = runTargets(ctx.root, ctx.policy, task.red_targets);
      } else {
        // Later TDD cycle: production already changed. Replay against base production code.
        mode = "replay_worktree";
        run = withScratchWorktree(ctx.root, snapshotWorktree(ctx.root), (wt) => {
          revertToBase(wt, task.start_head, revert);
          return runTargets(wt, ctx.policy, task.red_targets);
        });
      }
    } catch (error) {
      if (error instanceof HarnessError && error.code === EXIT.TOOL_FAILURE) {
        appendEvidence(ctx.root, task, { kind: "red", outcome: "TOOL_FAILURE", mode, production_at_base: true, message: redact(error.message), expects, fingerprint: fingerprint(owned) });
        persist(ctx, task);
      }
      throw error;
    }
    const judgement = judgeRed(ctx.policy, task.red_targets, run.results);
    appendEvidence(ctx.root, task, {
      kind: "red",
      outcome: judgement.valid ? "VALID_RED" : "INVALID_RED",
      mode,
      production_at_base: true,
      reverted_files: revert.length,
      commands: run.commands,
      targets: judgement.targets,
      expects,
      fingerprint: fingerprint(owned)
    });
    persist(ctx, task);
    for (const t of judgement.targets) console.log(`  ${t.valid ? "VALID  " : "INVALID"} ${t.id} — ${t.outcome}: ${t.reason}${t.valid ? "" : t.excerpt ? `\n      ${t.excerpt}` : ""}`);
    if (!judgement.valid) throw violation("INVALID_RED — not recorded as RED. Fix the test/infrastructure; do not proceed to production code.");
    console.log(`VALID_RED recorded (${mode}). Production edits are now allowed for ${task.id}.`);
  },

  green(ctx, args) {
    const task = currentTask(ctx, args);
    const targets = greenTargets(task);
    if (!targets.length) throw violation("no red/sensitivity targets to run");
    const owned = ownedBlobs(ctx.root, ctx.policy, task);
    const run = runTargets(ctx.root, ctx.policy, targets);
    const g = judgeGreen(targets, run.results);
    appendEvidence(ctx.root, task, { kind: "green", outcome: g.valid ? "GREEN" : "NOT_GREEN", commands: run.commands, targets: g.targets, fingerprint: fingerprint(owned) });
    persist(ctx, task);
    for (const t of g.targets) console.log(`  ${t.outcome.padEnd(10)} ${t.id}${t.excerpt ? `\n      ${t.excerpt}` : ""}`);
    if (!g.valid) throw violation("not GREEN");
    console.log("GREEN recorded.");
  },

  sensitivity(ctx, args) {
    const task = currentTask(ctx, args);
    const file = flag(args, "file");
    if (file) {
      task.sensitivity = { ...(task.sensitivity ?? {}), mutation: { file: String(file), find: String(flag(args, "find") ?? ""), replace: String(flag(args, "replace") ?? "") } };
    }
    const added = parseTargets(args.ordered);
    if (added.length) task.sensitivity = { ...(task.sensitivity ?? {}), targets: mergeTargets(task.sensitivity?.targets, added) };
    const targets = sensitivityTargets(task);
    if (!task.sensitivity?.mutation?.find || !targets.length) throw violation("usage: pnpm quality sensitivity --file <prod file> --find <text> --replace <text> --go ./pkg:TestX");
    const problems = [...targets.flatMap((t) => validateTarget(t, { requireExpect: true })), ...validateMutation(ctx.policy, task.sensitivity.mutation)];
    if (problems.length) throw violation(problems.join("; "));
    const owned = ownedBlobs(ctx.root, ctx.policy, task);
    const result = withScratchWorktree(ctx.root, snapshotWorktree(ctx.root), (wt) => {
      applyMutation(wt, task.sensitivity.mutation, ctx.policy);
      return runTargets(wt, ctx.policy, targets);
    });
    const judgement = judgeRed(ctx.policy, targets, result.results);
    const outcome = judgement.valid ? "SENSITIVE" : "INSENSITIVE";
    const expects = Object.fromEntries(targets.map((t) => [targetId(t), t.expect]));
    appendEvidence(ctx.root, task, { kind: "sensitivity", outcome, mutation: task.sensitivity.mutation, commands: result.commands, targets: judgement.targets, expects, fingerprint: fingerprint(owned) });
    persist(ctx, task);
    for (const j of judgement.targets) console.log(`  ${j.valid ? "FAILS AS EXPECTED" : "NOT SENSITIVE   "} ${j.id} — ${j.outcome}${j.valid ? "" : `: ${j.reason}`}`);
    if (outcome !== "SENSITIVE") throw violation("INSENSITIVE — under the mutation the tests do not fail with the declared assertion text (or the mutation broke compilation)");
    console.log("SENSITIVE recorded (the working tree was never modified).");
  },

  deletion(ctx, args) {
    const task = currentTask(ctx, args);
    const symbols = flagList(args, "symbol").map(String);
    task.deletion = { symbols: [], consumer_audit: "", allowed_references: [], ...(task.deletion ?? {}) };
    if (symbols.length) task.deletion.symbols = [...new Set([...task.deletion.symbols, ...symbols])];
    if (flag(args, "audit")) task.deletion.consumer_audit = String(flag(args, "audit"));
    for (const a of flagList(args, "allow")) {
      const [p, ...reason] = String(a).split("=");
      task.deletion.allowed_references.push({ path: p, reason: reason.join("=") });
    }
    if (!task.deletion.symbols.length) throw violation("usage: pnpm quality deletion --symbol <removed identifier/route> --audit \"<consumers checked>\"");
    const hits = staleReferences(ctx.root, ctx.policy, task.deletion);
    const owned = ownedBlobs(ctx.root, ctx.policy, task);
    appendEvidence(ctx.root, task, { kind: "deletion_scan", symbols: task.deletion.symbols, hits: hits.slice(0, 50), result: hits.length ? "FAIL" : "PASS", fingerprint: fingerprint(owned) });
    persist(ctx, task);
    for (const h of hits.slice(0, 50)) console.log(`  stale reference: ${h.path}:${h.line} (${h.symbol})`);
    if (hits.length) throw violation(`${hits.length} stale reference(s) remain`);
    console.log("Stale-reference scan PASS.");
  },

  verify(ctx, args) {
    const task = currentTask(ctx, args);
    const { evaluation } = localEvaluation(ctx, task);
    if (evaluation.errors.length) throw violation(`fix classification first: ${evaluation.errors.join("; ")}`);
    const wanted = flagList(args, "suite");
    const suites = orderedGates(evaluation).filter((g) => ctx.policy.raw.gates[g].type === "suite" && (!wanted.length || wanted.includes(g)));
    if (!suites.length) {
      console.log("No suites are required for this task.");
      return;
    }
    let worst = EXIT.PASS;
    for (const gate of suites) {
      const def = ctx.policy.raw.gates[gate];
      const command = def.needs_db && !process.env.TEST_DATABASE_URL ? ["bash", "scripts/quality/with-test-db.sh", ...def.command] : def.command;
      const dir = mkdtempSync(path.join(os.tmpdir(), "quality-summary-"));
      const before = fingerprint(ownedBlobs(ctx.root, ctx.policy, task));
      console.log(`\n=== ${gate}: ${command.join(" ")}`);
      const r = spawnSync(command[0], command.slice(1), { cwd: ctx.root, stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, QUALITY_SUMMARY_DIR: dir } });
      const after = fingerprint(ownedBlobs(ctx.root, ctx.policy, task));
      const summaryFile = path.join(dir, `${def.summary}.json`);
      let summary = null;
      if (existsSync(summaryFile)) summary = JSON.parse(readFileSync(summaryFile, "utf8"));
      rmSync(dir, { recursive: true, force: true });
      let result = summary?.result ?? (r.status === 0 ? "TOOL_FAILURE" : "FAIL");
      let message = summary?.message ?? (summary ? "" : "suite produced no execution accounting");
      if (r.error) [result, message] = ["TOOL_FAILURE", r.error.message];
      if (before !== after) [result, message] = ["TOOL_FAILURE", "task files changed while the suite ran — evidence would not describe one state"];
      if (r.status !== 0 && result === "PASS") [result, message] = ["FAIL", `a later step of ${def.command.join(" ")} failed (exit ${r.status})`];
      appendEvidence(ctx.root, task, { kind: "suite", gate, command: command.join(" "), exit_code: r.status ?? -1, result, accounting: summary?.accounting ?? null, message: redact(message), fingerprint: before });
      persist(ctx, task);
      console.log(`--- ${gate}: ${result} (exit ${r.status})${summary?.accounting ? ` ${JSON.stringify(summary.accounting)}` : ""}`);
      if (result === "TOOL_FAILURE") worst = EXIT.TOOL_FAILURE;
      else if (result !== "PASS" && worst === EXIT.PASS) worst = EXIT.VIOLATION;
    }
    if (worst !== EXIT.PASS) throw new HarnessError("one or more required suites did not pass", worst);
  },

  evidence(ctx, args) {
    const task = currentTask(ctx, args);
    const gate = args.positional[0];
    const def = ctx.policy.raw.gates[gate];
    if (!def || def.type !== "command") throw violation(`usage: pnpm quality evidence <command gate> -- <command...> (command gates: ${Object.entries(ctx.policy.raw.gates).filter(([, g]) => g.type === "command").map(([id]) => id).join(", ")})`);
    if (!args.rest?.length) throw violation("missing command after --");
    const before = fingerprint(ownedBlobs(ctx.root, ctx.policy, task));
    const r = spawnSync(args.rest[0], args.rest.slice(1), { cwd: ctx.root, stdio: ["ignore", "inherit", "inherit"] });
    const after = fingerprint(ownedBlobs(ctx.root, ctx.policy, task));
    const exit = before !== after ? -1 : r.status ?? -1;
    appendEvidence(ctx.root, task, { kind: "command", gate, command: redact(args.rest.join(" ")), exit_code: exit, fingerprint: before });
    persist(ctx, task);
    if (exit !== 0) throw violation(`${gate}: command failed (exit ${exit})`);
    console.log(`${gate} recorded (exit 0).`);
  },

  claim(ctx, args) {
    const task = currentTask(ctx, args);
    const rel = args.positional[0];
    if (!rel) throw violation("usage: pnpm quality claim <path>   (own a file that was already modified when the task began)");
    if (task.closed) throw violation(`${task.id} is CLOSED`);
    if (!(rel in (task.preexisting_changes ?? {}))) throw violation(`${rel} was not a pre-existing change; it is owned automatically when changed`);
    task.claimed = [...new Set([...(task.claimed ?? []), rel])];
    persist(ctx, task);
    console.log(`${rel} is now owned by ${task.id}; its whole diff vs start_head is part of this task.`);
  },

  disown(ctx, args) {
    const task = currentTask(ctx, args);
    const rel = args.positional[0];
    const reason = flag(args, "reason");
    if (!rel || !reason || reason === true) throw violation('usage: pnpm quality disown <path> --reason "<why this change is not part of the task>"');
    if (task.closed) throw violation(`${task.id} is CLOSED`);
    // Safe by construction: a disowned file that is later committed is UNOWNED in CI.
    const blob = existsSync(path.join(ctx.root, rel)) ? git(ctx.root, ["hash-object", rel]).stdout.trim() : null;
    task.claimed = (task.claimed ?? []).filter((p) => p !== rel);
    task.preexisting_changes = { ...task.preexisting_changes, [rel]: blob };
    task.disowned = [...(task.disowned ?? []), { path: rel, reason: String(reason), at: new Date().toISOString() }];
    persist(ctx, task);
    console.log(`${rel} is not owned by ${task.id} (current content recorded as pre-existing). Do not commit it with this task.`);
  },

  block(ctx, args) {
    const task = currentTask(ctx, args);
    const gate = args.positional[0];
    const file = flag(args, "protocol");
    if (!gate || !file) throw violation("usage: pnpm quality block <gate> --protocol <blocker.json>");
    const protocol = readJson(path.resolve(String(file)), "blocker protocol");
    const problems = validateBlockerProtocol(ctx.policy, gate, protocol, task, fingerprint(ownedBlobs(ctx.root, ctx.policy, task)));
    if (problems.length) throw violation(`BLOCKED claim rejected:\n  - ${problems.join("\n  - ")}`);
    const clean = JSON.parse(JSON.stringify(protocol, (_k, v) => (typeof v === "string" ? redact(v, 600) : v)));
    appendEvidence(ctx.root, task, { kind: "blocked", gate, protocol: clean, fingerprint: fingerprint(ownedBlobs(ctx.root, ctx.policy, task)) });
    persist(ctx, task);
    console.log(`${gate} recorded as BLOCKED. The task can close only as PARTIAL — never VERIFIED.`);
  },

  review(ctx, args) {
    const task = currentTask(ctx, args);
    const sub = args.positional[0];
    const { owned, findings, evaluation } = localEvaluation(ctx, task);
    if (sub === "prepare" || sub === "run") {
      const text = buildReviewPackage(ctx.root, ctx.policy, task, owned, evaluation, findings);
      const pkg = writeReviewPackage(ctx.root, ctx.policy, task, text);
      console.log(`Review package: ${path.relative(ctx.root, pkg.file)} (sha256 ${short(pkg.sha)}, fingerprint ${short(evaluation.fingerprint)})`);
      if (sub === "prepare") {
        console.log("Give it to a fresh reviewer session, then: pnpm quality review run  (or: review record --reviewer <who> --mode human --verdict APPROVE)");
        return;
      }
      const result = runReviewer(ctx.root, text);
      writeFileSync(pkg.file.replace(/\.md$/u, ".out.md"), result.output);
      const now = fingerprint(ownedBlobs(ctx.root, ctx.policy, task));
      if (now !== evaluation.fingerprint) throw toolFailure("task files changed during the review — re-run");
      appendEvidence(ctx.root, task, {
        kind: "review",
        mode: "fresh_session",
        reviewer: result.label,
        verdict: result.verdict.verdict,
        open_findings: result.verdict.open_findings,
        findings: (result.verdict.findings ?? []).slice(0, 10).map((f) => ({ severity: f.severity, file: f.file, summary: redact(f.summary, 200) })),
        package_sha256: pkg.sha,
        fingerprint: evaluation.fingerprint
      });
      persist(ctx, task);
      console.log(`Review: ${result.verdict.verdict}, open findings ${result.verdict.open_findings}. Full output: ${path.relative(ctx.root, pkg.file.replace(/\.md$/u, ".out.md"))}`);
      if (result.verdict.verdict !== "APPROVE" || result.verdict.open_findings !== 0) throw violation("review did not approve");
      return;
    }
    if (sub === "record") {
      const verdict = String(flag(args, "verdict") ?? "").toUpperCase();
      const reviewer = flag(args, "reviewer");
      const usage = "usage: pnpm quality review record --reviewer <who> --verdict APPROVE|CHANGES_REQUESTED [--mode human] [--open-findings N] [--notes ...]\n       pnpm quality review record --reviewer <session> --mode fresh_session --output <reviewer output file with the verdict JSON line>";
      if (!["APPROVE", "CHANGES_REQUESTED"].includes(verdict) || !reviewer || reviewer === true) throw violation(usage);
      const mode = String(flag(args, "mode") ?? "human");
      if (!["human", "fresh_session"].includes(mode)) throw violation(usage);
      let openFindings = Number(flag(args, "open-findings") ?? 0);
      let outputSha;
      if (mode === "fresh_session") {
        // A fresh-session review must come with the reviewer's own output; the
        // recorded verdict is parsed from it, not typed by the builder.
        const out = flag(args, "output");
        if (!out || out === true || !existsSync(path.resolve(String(out)))) throw violation(`fresh_session reviews need --output <file>\n${usage}`);
        const text = readFileSync(path.resolve(String(out)), "utf8");
        const parsed = parseVerdict(text);
        if (parsed.verdict !== verdict) throw violation(`--verdict ${verdict} does not match the reviewer output (${parsed.verdict})`);
        openFindings = parsed.open_findings;
        outputSha = sha256(text);
      }
      appendEvidence(ctx.root, task, {
        kind: "review",
        mode,
        reviewer: String(reviewer),
        verdict,
        open_findings: openFindings,
        notes: redact(flag(args, "notes") ?? "", 600),
        ...(outputSha ? { output_sha256: outputSha } : {}),
        attested: true,
        fingerprint: evaluation.fingerprint
      });
      persist(ctx, task);
      console.log(`Review recorded: ${verdict} by ${reviewer} (${mode}).`);
      return;
    }
    throw violation("usage: pnpm quality review prepare|run|record");
  },

  status(ctx, args) {
    const id = flag(args, "task") ?? activeTaskId(ctx.root, ctx.policy);
    if (!id) {
      const open = listTasks(ctx.root, ctx.policy).filter((t) => !loadTask(ctx.root, ctx.policy, t).closed);
      console.log(`No active task.${open.length ? ` Open tasks: ${open.join(", ")} (pnpm quality status --task <ID>)` : ""}\nStart one: pnpm quality begin <ID-123> "<title>"`);
      return;
    }
    printStatus(ctx, loadTask(ctx.root, ctx.policy, id));
  },

  /** Claim -> evidence report for final summaries, generated from the record (never from memory). */
  report(ctx, args) {
    const task = currentTaskOrClosed(ctx, args);
    const { owned, findings, evaluation } = task.closed
      ? { owned: task.closed.files, findings: [], evaluation: evaluate(ctx.policy, task, { root: ctx.root, owned: task.closed.files, fingerprint: task.closed.fingerprint }) }
      : localEvaluation(ctx, task);
    const lastOf = (pred) => task.evidence.filter(pred).sort((a, b) => b.seq - a.seq)[0];
    const lines = [
      `## ${task.id} — ${task.title}`,
      "",
      `- status: **${task.closed ? task.closed.status : evaluation.status}** (${task.closed ? "CLOSED" : deriveState(ctx.policy, task, evaluation)})`,
      `- start_head: \`${task.start_head}\` · verified fingerprint: \`${evaluation.fingerprint}\` (${Object.keys(owned).length} files)${task.closed ? ` · closed at HEAD \`${task.closed.head}\`` : ""}`,
      `- classification: ${task.classification?.classes?.join(", ")} / ${task.classification?.change_kind}${task.red_exception ? ` (red_exception ${task.red_exception.category})` : ""}`,
      "",
      "| claim (gate) | result | evidence |",
      "|---|---|---|"
    ];
    for (const gate of orderedGates(evaluation)) {
      const s = evaluation.gates[gate];
      const def = ctx.policy.raw.gates[gate];
      const e = lastOf((x) => (x.gate === gate && ["suite", "command", "blocked"].includes(x.kind)) || (def.type === x.kind) || (gate === "deletion_audit" && x.kind === "deletion_scan"));
      let detail = s.detail;
      if (e?.kind === "suite") detail = `\`${e.command}\` exit ${e.exit_code}; ${JSON.stringify(e.accounting)}`;
      else if (e?.kind === "command") detail = `\`${e.command}\` exit ${e.exit_code}`;
      else if (e?.kind === "red" || e?.kind === "green" || e?.kind === "sensitivity") detail = `${(e.commands ?? []).map((c) => `\`${c}\``).join("; ")} → ${e.outcome}`;
      else if (e?.kind === "review") detail = `${e.reviewer} (${e.mode}): ${e.verdict}, open findings ${e.open_findings}`;
      else if (e?.kind === "blocked") detail = `BLOCKED: ${e.protocol?.error}`;
      lines.push(`| ${gate} | ${s.status} | ${String(detail).replace(/\|/g, "\\|")} |`);
    }
    if (findings.length || task.risk_acknowledgements?.length) {
      lines.push("", "Risk acknowledgements:", ...(task.risk_acknowledgements ?? []).map((a) => `- ${a.finding}: ${a.reason}`));
    }
    console.log(lines.join("\n"));
  },

  close(ctx, args) {
    const task = currentTask(ctx, args);
    if (task.closed) throw violation(`${task.id} is already CLOSED`);
    const evaluation = printStatus(ctx, task);
    const invariants = checkInvariants(ctx.root);
    for (const v of invariants) console.log(`  ! [invariant ${v.id}] ${v.message}`);
    if (!["VERIFIED", "PARTIAL"].includes(evaluation.status) || invariants.length) {
      throw violation(`cannot close ${task.id}: verification is ${evaluation.status}${invariants.length ? ` and ${invariants.length} quality-system invariant(s) fail` : ""}`);
    }
    const owned = ownedBlobs(ctx.root, ctx.policy, task);
    task.closed = {
      at: new Date().toISOString(),
      head: headSha(ctx.root),
      fingerprint: fingerprint(owned),
      status: evaluation.status,
      gates: Object.fromEntries(orderedGates(evaluation).map((g) => [g, evaluation.gates[g].status])),
      files: owned
    };
    recordState(ctx.root, task, "CLOSED");
    saveTask(ctx.root, ctx.policy, task);
    setActive(ctx.root, ctx.policy, null);
    console.log(`\n${task.id} CLOSED as ${evaluation.status} (fingerprint ${short(task.closed.fingerprint)}, ${Object.keys(owned).length} files). Commit tasks/${task.id}.json with the change.`);
    if (evaluation.status === "PARTIAL") console.log("PARTIAL: a required gate is BLOCKED. Report it as PARTIAL, never as VERIFIED.");
  },

  check(ctx, args) {
    const { base, head } = resolveRange(ctx, args);
    const r = lifecycleCheck(ctx.root, ctx.policy, { base, head, acceptPartial: process.env[ctx.policy.raw.merge_policy?.partial_acceptance_env ?? "QUALITY_ACCEPT_PARTIAL"] === "true" });
    console.log(`lifecycle check ${short(base)}..${head === "WORKTREE" ? "WORKTREE" : short(head)}: ${r.diff.length} changed file(s), ${r.tasks.length} task(s)`);
    for (const t of r.tasks) console.log(`  ${t.id}: ${t.status}${t.attested.length ? ` — ATTESTED (not recomputable by CI): ${t.attested.join(", ")}` : ""}`);
    for (const n of r.notes) console.log(`  note: ${n}`);
    for (const p of r.problems) {
      console.log(`  ✗ ${p}`);
      annotate("error", p);
    }
    stepSummary([
      `### Engineering lifecycle check`,
      `range \`${short(base)}..${head === "WORKTREE" ? "WORKTREE" : short(head)}\` — ${r.diff.length} files, ${r.tasks.length} task(s)`,
      ...r.tasks.map((t) => `- **${t.id}**: ${t.status}${t.attested.length ? ` — attested, not machine-verified: ${t.attested.join(", ")}` : ""}`),
      ...r.notes.map((n) => `- note: ${n}`),
      ...r.problems.map((p) => `- ❌ ${p}`)
    ]);
    if (r.problems.length) throw violation(`${r.problems.length} lifecycle problem(s)`);
    console.log("RESULT: PASS — lifecycle invariants hold for this range.");
  },

  replay(ctx, args) {
    const { base, head } = resolveRange(ctx, args);
    const inPlace = Boolean(flag(args, "ci"));
    if (inPlace && !process.env.GITHUB_ACTIONS && !flag(args, "i-know-this-rewrites-files")) {
      throw violation("--ci replays in place and temporarily rewrites files; it is meant for disposable CI checkouts");
    }
    const r = lifecycleCheck(ctx.root, ctx.policy, { base, head });
    const tasks = r.tasks.map((t) => t.task);
    if (!tasks.length) {
      console.log("No closed tasks in this range — nothing to replay.");
      return;
    }
    const results = replayAll(ctx.root, ctx.policy, { base, head: inPlace ? "HEAD" : head, tasks, inPlace });
    let failed = 0;
    for (const t of results) {
      if (!t.steps.length) console.log(`  ${t.id}: no replayable gates (no red/green/sensitivity required)`);
      for (const s of t.steps) {
        console.log(`  ${s.ok ? "✓" : "✗"} ${t.id} ${s.step}: ${s.detail}`);
        if (!s.ok) {
          failed += 1;
          annotate("error", `${t.id} ${s.step}: ${s.detail}`);
        }
      }
    }
    stepSummary(["### RED/GREEN replay", ...results.flatMap((t) => t.steps.map((s) => `- ${s.ok ? "✅" : "❌"} ${t.id} ${s.step}: ${s.detail}`))]);
    if (failed) throw violation(`${failed} replay step(s) failed — recorded TDD evidence does not hold for the code being merged`);
    console.log("RESULT: PASS — RED/GREEN/sensitivity evidence reproduced.");
  },

  invariants(ctx) {
    const v = checkInvariants(ctx.root);
    for (const x of v) console.log(`  ✗ [${x.id}] ${x.message}`);
    if (v.length) throw violation(`${v.length} quality-system invariant violation(s)`);
    console.log("RESULT: PASS — quality-system invariants hold.");
  },

  "self-test"(ctx) {
    const s = runSelfTest(ctx.root, ctx.policy);
    writeSuiteSummary("suite_harness", s.result, s.accounting, s.problems.join("; "));
    console.log(`harness self-test: ${JSON.stringify(s.accounting)}`);
    for (const p of s.problems) console.log(`  ✗ ${p}`);
    if (s.result !== "PASS") throw violation("harness self-test failed");
    console.log("RESULT: PASS — harness self-test (invariants + adversarial suite).");
  },

  guard(ctx, args) {
    const rel = args.positional[0];
    if (!rel) throw violation("usage: pnpm quality guard <repo-relative path>");
    const d = decidePath(ctx.root, ctx.policy, rel);
    console.log(`${d.decision.toUpperCase()}: ${d.reason}`);
    if (d.decision !== "allow") throw violation("write would be denied");
  },

  "install-hooks"(ctx, args) {
    if (!flag(args, "yes")) {
      console.log("Sets this repository's core.hooksPath to .githooks (pre-push runs `pnpm quality check`).");
      console.log("Any previously configured hooksPath is remembered and still executed. Re-run with --yes to apply.");
      return;
    }
    const previous = git(ctx.root, ["config", "--get", "core.hooksPath"], { allowFail: true }).stdout.trim();
    if (previous && previous !== ".githooks") git(ctx.root, ["config", "--local", "quality.chainHooksPath", previous]);
    git(ctx.root, ["config", "--local", "core.hooksPath", ".githooks"]);
    console.log(`core.hooksPath=.githooks${previous && previous !== ".githooks" ? ` (chaining ${previous})` : ""}`);
  },


  async context(ctx, args) {
    const sub = args.positional[0];
    const readRuntimeFiles = async () => {
      const os = await import('node:os');
      const fsp = await import('node:path');
      const fsMod = await import('node:fs');
      const codexCfgPath = fsp.join(os.homedir(), '.codex', 'config.toml');
      const proxyPath = fsp.join(os.homedir(), '.codex', 'proxy', 'ghostcli-proxy.mjs');
      const result = {};
      if (fsMod.existsSync(codexCfgPath)) result.codexConfig = fsMod.readFileSync(codexCfgPath, 'utf8');
      if (fsMod.existsSync(proxyPath)) result.proxyScript = fsMod.readFileSync(proxyPath, 'utf8');
      return result;
    };
    const parseRuntime = async () => {
      const runtime = { provider: 'ghostcli', model: 'claude-fable-5.1', provider_context_window: 256000, local_proxy_window: null, client_context_window: null };
      const files = await readRuntimeFiles();
      if (files.codexConfig) {
        const mWin = files.codexConfig.match(/model_context_window\s*=\s*(\d+)/);
        const mModel = files.codexConfig.match(/model\s*=\s*"([^"]+)"/);
        const mProv = files.codexConfig.match(/model_provider\s*=\s*"([^"]+)"/);
        if (mWin) runtime.client_context_window = parseInt(mWin[1], 10);
        if (mModel) runtime.model = mModel[1];
        if (mProv) runtime.provider = mProv[1];
      }
      if (files.proxyScript) {
        const mSafe = files.proxyScript.match(/SAFE_CONTEXT_WINDOW\s*=\s*(\d+)/);
        if (mSafe) runtime.local_proxy_window = parseInt(mSafe[1], 10);
      }
      // Provider upstream window: default known value for ghostcli:fable-5.1 unless overridden
      // In production this would come from the upstream /models endpoint; here we use the known upstream metadata.
      if (runtime.provider === 'ghostcli' && runtime.model === 'claude-fable-5.1') runtime.provider_context_window = 256000;
      return { runtime, files };
    };
    if (sub === 'status') {
      const policy = loadContextPolicy(ctx.root);
      const { runtime, files } = await parseRuntime();
      const resolved = resolveContextPolicy(policy, runtime);
      console.log('Provider:              ' + resolved.provider);
      console.log('Model:                 ' + resolved.model);
      console.log('Upstream provider:     ' + (resolved.provider_context_window ?? 'unavailable'));
      console.log('Verified reliable:     ' + (resolved.verified_reliable_window ?? 'none'));
      console.log('Local proxy cap:       ' + (resolved.local_proxy_window ?? 'none'));
      console.log('Codex client cap:      ' + (resolved.client_context_window ?? 'none'));
      console.log('Effective operating:   ' + resolved.effective_operating_window);
      console.log('Thresholds:');
      console.log('  checkpoint:          ' + resolved.checkpoint_threshold);
      console.log('  compact:             ' + resolved.compact_threshold);
      console.log('  danger:              ' + resolved.danger_threshold);
      console.log('Status:                ' + resolved.status);
      for (const n of resolved.notes) console.log('  note: ' + n);
      const sync = checkRuntimeSync(resolved, files);
      if (sync.ok) {
        console.log('Runtime sync:          CONSISTENT');
      } else {
        console.log('Runtime sync:          MISMATCH');
        for (const m of sync.mismatches) console.log('  ! ' + m);
      }
    } else if (sub === 'check') {
      const policy = loadContextPolicy(ctx.root);
      const { runtime, files } = await parseRuntime();
      const resolved = resolveContextPolicy(policy, runtime);
      const problems = [];
      const sync = checkRuntimeSync(resolved, files);
      for (const m of sync.mismatches) problems.push('runtime mismatch: ' + m);
      if (problems.length) {
        for (const p of problems) console.log('  ✗ ' + p);
        throw violation(problems.length + ' context policy problem(s)');
      }
      console.log('RESULT: PASS — adaptive context policy consistent.');
    } else if (sub === 'sync') {
      const hasCheckFlag = args.flags.check !== undefined || args.positional[1] === '--check';
      if (!hasCheckFlag) {
        console.log('usage: pnpm quality context sync --check');
        console.log('  Reports expected vs actual runtime values for Codex config and proxy.');
        console.log('  Automatic --apply is not implemented; update runtime files manually after revalidation.');
        return;
      }
      const policy = loadContextPolicy(ctx.root);
      const { runtime, files } = await parseRuntime();
      const resolved = resolveContextPolicy(policy, runtime);
      const sync = checkRuntimeSync(resolved, files);
      console.log('Expected effective:    ' + sync.expected.effective_operating_window);
      console.log('Expected compact:      ' + sync.expected.compact_threshold);
      if (sync.actual.codex_context_window !== undefined) console.log('Actual codex window:   ' + sync.actual.codex_context_window);
      if (sync.actual.codex_auto_compact !== undefined) console.log('Actual codex compact:  ' + sync.actual.codex_auto_compact);
      if (sync.actual.proxy_safe_window !== undefined) console.log('Actual proxy window:   ' + sync.actual.proxy_safe_window);
      if (sync.ok) {
        console.log('RESULT: PASS — runtime is in sync with canonical policy.');
      } else {
        console.log('Mismatches:');
        for (const m of sync.mismatches) console.log('  ✗ ' + m);
        console.log('Update ~/.codex/config.toml and/or ~/.codex/proxy/ghostcli-proxy.mjs to match.');
        throw violation(sync.mismatches.length + ' runtime sync mismatch(es)');
      }
    } else {
      console.log('usage: pnpm quality context status|check|sync --check');
    }
  },
  help() {
    const lines = readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1);
    const header = lines.slice(0, lines.findIndex((l) => !l.startsWith("//")));
    console.log(header.map((l) => l.replace(/^\/\/ ?/u, "")).join("\n"));
  }
};

function currentTaskOrClosed(ctx, args) {
  const id = flag(args, "task") ?? activeTaskId(ctx.root, ctx.policy);
  if (!id) throw violation("no active task — pass --task <ID>");
  return loadTask(ctx.root, ctx.policy, id);
}

function resolveRange(ctx, args) {
  const ci = Boolean(flag(args, "ci"));
  let base = flag(args, "base") ?? process.env.QUALITY_BASE;
  let head = flag(args, "head") ?? (ci ? "HEAD" : "WORKTREE");
  if (head !== "WORKTREE") head = resolveCommit(ctx.root, head);
  if (!base || base === true || /^0+$/u.test(base) || !commitExists(ctx.root, base)) {
    if (ci) {
      // Fail closed: checking only the last commit of an unknown range (force push,
      // new branch) would let earlier commits through unchecked.
      throw toolFailure(`diff base ${JSON.stringify(base ?? null)} is missing or not in history (force push / new branch?) — the lifecycle gate cannot determine what changed`);
    } else {
      const upstream = git(ctx.root, ["merge-base", "HEAD", "origin/main"], { allowFail: true });
      base = upstream.status === 0 ? upstream.stdout.trim() : "HEAD";
    }
  }
  return { base: resolveCommit(ctx.root, base), head };
}

export async function main(argv) {
  const aliases = { task: null };
  let [cmd, ...rest] = argv;
  if (cmd in aliases && rest.length) [cmd, ...rest] = rest; // `quality task begin` == `quality begin`
  if (!cmd || cmd === "--help" || cmd === "-h") cmd = "help";
  const fn = commands[cmd];
  if (!fn) {
    console.error(`unknown command ${cmd}; run: pnpm quality help`);
    return EXIT.VIOLATION;
  }
  try {
    const ctx = cmd === "help" ? null : context();
    await fn(ctx, parseArgs(rest));
    return EXIT.PASS;
  } catch (error) {
    if (error instanceof HarnessError) {
      console.error(`\nRESULT: ${error.code === EXIT.TOOL_FAILURE ? "TOOL_FAILURE" : "VIOLATION"} — ${error.message}`);
      return error.code;
    }
    console.error(`\nRESULT: TOOL_FAILURE — ${error?.stack ?? error}`);
    return EXIT.TOOL_FAILURE;
  }
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href || process.argv[1]?.endsWith("cli.mjs")) {
  process.exitCode = await main(process.argv.slice(2));
}
