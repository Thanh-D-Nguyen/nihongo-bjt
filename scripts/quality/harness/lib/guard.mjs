// Write guard used by the Claude Code PreToolUse hook (and `pnpm quality guard`).
//
// Scope, stated honestly: this is LOCAL friction for agents that run with
// project hooks enabled. It reliably covers the file-editing tools
// (Write/Edit/MultiEdit/NotebookEdit) and catches common shell write idioms
// (redirection, sed -i, tee, cp/mv/rm, patch, git apply/checkout/restore) by
// heuristic. It cannot see writes made by arbitrary programs, and sessions
// started with --bare or without project hooks skip it entirely. The binding
// controls are the lifecycle check + replay in CI (lib/check.mjs, lib/replay.mjs).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { pathRule, redRequired } from "./policy.mjs";
import { activeTaskId, loadTask } from "./task.mjs";
import { classifyAction, shellAction } from "./autonomy.mjs";

const PROTECTED_TASK_FIELDS = ["schema", "id", "start_head", "preexisting_changes", "claimed", "disowned", "state", "history", "evidence", "closed", "execution"];
const STATE_RANK = ["CREATED", "SPECIFIED", "CLASSIFIED"];

const allow = (reason = "") => ({ decision: "allow", reason });
const deny = (reason) => ({ decision: "deny", reason });

function classified(task) {
  return Boolean(task?.classification?.classes?.length) && Array.isArray(task?.spec?.acceptance) && task.spec.acceptance.length > 0;
}

const hasValidRed = (task) => task.evidence?.some((e) => e.kind === "red" && e.outcome === "VALID_RED" && e.production_at_base === true);

/** Decide whether `relPath` may be written under the active task. */
export function decidePath(root, policy, relPath, { taskOverride } = {}) {
  const rule = pathRule(policy, relPath);
  if (rule.kind === "doc") return allow("documentation");
  if (rule.kind === "task_record") return allow("task record (evidence fields are checked separately)");

  let task = taskOverride;
  if (task === undefined) {
    const id = activeTaskId(root, policy);
    if (!id) {
      return deny(`No active task. ${relPath} is ${rule.kind}; start the lifecycle first:\n  pnpm quality begin <ID-123> "<title>"   (see docs/engineering/ENGINEERING_POLICY.md §16)`);
    }
    try {
      task = loadTask(root, policy, id);
    } catch (error) {
      return deny(`Active task ${id} cannot be loaded (${error.message}). Run: pnpm quality status`);
    }
  }
  if (task.closed) return deny(`Active task ${task.id} is CLOSED. Begin a new task for further changes.`);
  if (!classified(task)) {
    const state = STATE_RANK.includes(task.state) ? task.state : "CREATED";
    return deny(`Task ${task.id} is ${state}: write spec.acceptance and classify before editing ${relPath}:\n  pnpm quality spec && pnpm quality classify <CLASS> --kind <kind>`);
  }
  const classes = task.classification.classes;
  if (Array.isArray(rule.requires_any) && !rule.requires_any.some((c) => classes.includes(c))) {
    return deny(`${relPath} is ${rule.kind} and requires class ${rule.requires_any.join(" | ")}; task ${task.id} is classified ${classes.join(", ")}. Reclassify first (pnpm quality classify ...).`);
  }
  if (rule.kind === "test") return allow("test file under a classified task");
  if (rule.production && redRequired(policy, task) && !hasValidRed(task)) {
    return deny(
      `VALID_RED required before production edits (${relPath}). Write the failing test first, then record it:\n` +
        `  pnpm quality red --go ./internal/pkg:TestName --expect "<failure text>"   (or --vitest <file>::"<suite > test>")\n` +
        `Brand-new code that cannot compile against the base? Declare it up front: pnpm quality classify ... --red-exception new_component --reason "..."`
    );
  }
  return allow(`task ${task.id}`);
}

/** Evidence/closure fields of a task record may only be written by the harness CLI. */
export function decideTaskRecordEdit(root, relPath, newContent) {
  const abs = path.join(root, relPath);
  if (!existsSync(abs)) {
    return newContent === null ? allow() : deny("Create task records with `pnpm quality begin`, not by hand.");
  }
  if (newContent === null) return deny("Task records are never deleted by an agent tool.");
  let before;
  let after;
  try {
    before = JSON.parse(readFileSync(abs, "utf8"));
    after = JSON.parse(newContent);
  } catch {
    return deny("Task record edit would produce invalid JSON.");
  }
  const changed = PROTECTED_TASK_FIELDS.filter((f) => JSON.stringify(before[f]) !== JSON.stringify(after[f]));
  if (changed.length) {
    return deny(`Task record fields ${changed.join(", ")} are written only by the harness (pnpm quality ...). Edit spec/classification/targets only.`);
  }
  return allow("task declaration edit");
}

const WRITE_TOOL = /(?:^|[;&|(]|\s)(?:sed\s+(?:-[a-zA-Z]*i\b|--in-place)|perl\s+-[a-zA-Z]*i|tee|cp|mv|rm|truncate|patch|install|dd|git\s+(?:apply|am|checkout|restore|mv|rm))(?=\s)/u;
const REDIRECT = /(?<![0-9&<>=-])>{1,2}\s*["']?([^\s;&|)<>"'`{}]+)/gu;
const HARNESS_COMMAND = /^\s*(?:pnpm\s+(?:run\s+)?quality\b|node\s+scripts\/quality\/harness\/cli\.mjs\b|(?:bash\s+)?scripts\/quality\/[\w-]+\.sh\b)/u;

function repoRelative(root, token) {
  const rel = token.startsWith("/") ? path.relative(root, token) : token.replace(/^\.\//u, "");
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel) || rel.startsWith("-")) return null;
  // Only tokens that name an existing path or a file in an existing directory
  // (excludes branch names like feature/x and URL fragments).
  if (!existsSync(path.join(root, rel)) && !existsSync(path.join(root, path.dirname(rel)))) return null;
  if (!rel.includes("/") && !/\.[A-Za-z]{1,5}$/u.test(rel)) return null;
  return rel;
}

/** Heuristic shell write detection: repo-relative paths a write-ish command may modify. */
export function shellWriteTargets(root, command) {
  if (HARNESS_COMMAND.test(command) && !/[;&|`]|\$\(/u.test(command)) return [];
  const out = new Set();
  for (const m of command.matchAll(REDIRECT)) {
    if (m[1] === "/dev/null" || m[1].startsWith("&")) continue;
    const rel = repoRelative(root, m[1].replace(/^["']|["']$/gu, ""));
    if (rel) out.add(rel);
  }
  if (WRITE_TOOL.test(command)) {
    for (const token of command.match(/[A-Za-z0-9_./@[\]-]+/gu) ?? []) {
      const rel = repoRelative(root, token);
      if (rel) out.add(rel);
    }
  }
  return [...out];
}

/** Hook entry point decision for a Claude Code tool call. */
export function decideToolCall(root, policy, toolName, toolInput = {}) {
  if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(toolName)) {
    const file = toolInput.file_path ?? toolInput.notebook_path;
    if (!file) return allow("no path");
    const abs = path.resolve(root, file);
    const rel = path.relative(root, abs);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return allow("outside the repository");
    const decision = decidePath(root, policy, rel);
    if (decision.decision === "deny") return decision;
    if (pathRule(policy, rel).kind === "task_record" && rel.endsWith(".json") && !rel.includes("/.")) {
      return decideTaskRecordEdit(root, rel, simulateEdit(abs, toolName, toolInput));
    }
    return decision;
  }
  if (toolName === "Bash") {
    const command = String(toolInput.command ?? "");
    const action = shellAction(command);
    const classification = action && classifyAction(policy, action);
    if (classification?.class === "FORBIDDEN") return deny(classification.reason);
    for (const rel of shellWriteTargets(root, command)) {
      const rule = pathRule(policy, rel);
      if (rule.kind === "task_record" && rel.endsWith(".json")) {
        return deny(`Shell writes to task records bypass evidence protection (${rel}). Use pnpm quality commands or the Edit tool for declarations.`);
      }
      const decision = decidePath(root, policy, rel);
      if (decision.decision === "deny") return deny(`Shell command appears to modify ${rel}.\n${decision.reason}`);
    }
    if (classification?.class === "DECISION_REQUIRED") return { decision: "ask", reason: `${action.impact}. Use native interactive choices; preserve continuation and continue independent work.`, action };
    return allow(classification?.reason ?? "");
  }
  return allow();
}

function simulateEdit(abs, toolName, input) {
  if (toolName === "Write") return input.content ?? "";
  if (!existsSync(abs)) return null;
  let text = readFileSync(abs, "utf8");
  const edits = toolName === "MultiEdit" ? input.edits ?? [] : [input];
  for (const e of edits) {
    if (typeof e.old_string !== "string") continue;
    text = e.replace_all ? text.split(e.old_string).join(e.new_string ?? "") : text.replace(e.old_string, () => e.new_string ?? "");
  }
  return text;
}
