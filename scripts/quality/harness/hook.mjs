#!/usr/bin/env node
// Claude Code PreToolUse hook (wired in .claude/settings.json). Reads the tool
// call JSON on stdin and denies writes the engineering lifecycle does not
// allow yet (see lib/guard.mjs for the exact scope and its limits).
//
// Fail-closed for file tools: if the guard itself breaks, Write/Edit outside
// docs is denied with the error. Bash is allowed on guard errors so the guard
// can still be diagnosed (`pnpm quality guard <path>`). A human can disable the
// guard for a session by launching the CLI with QUALITY_GUARD=off (an agent's
// tool calls cannot change the environment the hook runs in).
import { readFileSync } from "node:fs";
import path from "node:path";

import { decideToolCall } from "./lib/guard.mjs";
import { toplevel } from "./lib/git.mjs";
import { loadPolicy, pathRule } from "./lib/policy.mjs";
import { activeTaskId, loadTask } from "./lib/task.mjs";
import { nativeDecision, nativeOutcome } from "./lib/execution.mjs";
import { shellAction } from "./lib/autonomy.mjs";

function respond(decision, reason, additionalContext) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: `[quality guard] ${reason}`, ...(additionalContext ? { additionalContext } : {}) } })
  );
}

function readInput() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}
const input = readInput();

if (process.env.QUALITY_GUARD !== "off") {
  const tool = input.tool_name ?? "";
  try {
    const root = toplevel(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
    const policy = loadPolicy(root);
    if (["PostToolUse", "PostToolUseFailure"].includes(input.hook_event_name)) {
      await nativeOutcome({ root, policy }, input);
      process.exit(0);
    }
    const id = activeTaskId(root, policy);
    const task = id ? loadTask(root, policy, id) : null;
    const d = decideToolCall(root, policy, tool, input.tool_input ?? {});
    let context;
    if (d.decision === "ask" && task) {
      const pending = await nativeDecision({ root, policy }, task, input, d.action);
      context = `WAITING_FOR_DECISION ${pending.id}. Prefer AskUserQuestion with meaningful choices. Cancel via pnpm quality decision answer --id ${pending.id} --choice cancel; continue independent work. Native permission authorizes only this exact tool operation, no reusable consent.`;
    }
    respond(d.decision, d.reason, context);
  } catch (error) {
    const file = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
    const isDoc = (() => {
      try {
        const root = toplevel(process.env.CLAUDE_PROJECT_DIR || process.cwd());
        return file ? pathRule(loadPolicy(root), path.relative(root, path.resolve(root, file))).kind === "doc" : false;
      } catch {
        return false;
      }
    })();
    if (tool === "Bash" && shellAction(String(input.tool_input?.command ?? "")) || tool !== "Bash" && file && !isDoc) respond("deny", `guard error (failing closed): ${error?.message ?? error}. Diagnose/recover the guard locally.`);
    else process.stderr.write(`[quality guard] error (allowed): ${error?.message ?? error}\n`);
  }
}
