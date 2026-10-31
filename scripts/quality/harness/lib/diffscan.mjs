// High-risk change scanner. Finds ways to make a suite "pass" by weakening it:
// focused/skipped tests, swallowed failures, suppressions, deleted tests,
// fewer assertions, changed test discovery, weakened baselines.
//
// Finding identity is line-independent: `<rule>:<path>` (+ `:<detail>` for
// baselines), so an acknowledgement survives unrelated edits but never covers
// a different file.
import { readFileSync, readlinkSync } from "node:fs";
import path from "node:path";

import { blobsAt, git, showFile, worktreeBlobs, worktreeStat } from "./git.mjs";
import { pathRule } from "./policy.mjs";
import { matchesAny, redact } from "./util.mjs";

/** Unified diff (zero context) of one path between `base` and `head` (null head = working tree). */
function fileDiff(root, base, head, file) {
  const args = head ? ["diff", "-U0", "--no-renames", base, head, "--", file] : ["diff", "-U0", "--no-renames", base, "--", file];
  let out = git(root, args).stdout;
  if (!out && !head) {
    // Git treats directory symlinks as directories in --no-index mode.
    if (worktreeStat(root, file)?.isSymbolicLink()) return { added: readlinkSync(path.join(root, file)).split("\n"), removed: [] };
    // untracked file: diff against /dev/null
    const r = git(root, ["diff", "-U0", "--no-index", "--", "/dev/null", file], { allowFail: true });
    out = r.stdout;
  }
  const added = [];
  const removed = [];
  for (const line of out.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) added.push(line.slice(1));
    else if (line.startsWith("-")) removed.push(line.slice(1));
  }
  return { added, removed };
}

function contentAt(root, rev, file) {
  if (rev) return showFile(root, rev, file);
  const abs = path.join(root, file);
  const stat = worktreeStat(root, file);
  if (!stat || (!stat.isFile() && !stat.isSymbolicLink())) return null;
  return stat.isSymbolicLink() ? readlinkSync(abs) : readFileSync(abs, "utf8");
}

function ruleApplies(policy, rule, file) {
  if (rule.regexps && !matchesAny(file, rule.regexps)) return false;
  if (rule.kinds && !rule.kinds.includes(pathRule(policy, file).kind)) return false;
  return Boolean(rule.regexps || rule.kinds);
}

/**
 * Scan `files` changed between `base` and `head` (head null = working tree).
 * Returns findings: { id, rule, severity, path, detail }.
 */
export function scanDiff(root, policy, base, head, files) {
  const findings = [];
  const push = (rule, file, detail, suffix = "") =>
    findings.push({ id: `${rule.id}:${file}${suffix}`, rule: rule.id, severity: rule.severity, path: file, detail: redact(detail, 200) });

  for (const file of files) {
    const before = contentAt(root, base, file);
    const after = contentAt(root, head, file);
    const deleted = before !== null && after === null;
    let diff = null;
    const getDiff = () => (diff ??= fileDiff(root, base, head, file));

    for (const rule of policy.riskRules) {
      if (rule.baseline) continue;
      if (rule.whitespace_only) {
        if (before !== null && after !== null && before !== after && before.replace(/\s+/gu, "") === after.replace(/\s+/gu, "")) push(rule, file, "whitespace-only change");
        continue;
      }
      if (!ruleApplies(policy, rule, file)) continue;
      if (rule.deleted_file) {
        if (deleted) push(rule, file, "file deleted");
        continue;
      }
      if (rule.any_change) {
        if (before !== after || blobsAt(root, base, [file])[file] !== (head ? blobsAt(root, head, [file])[file] : worktreeBlobs(root, [file])[file])) push(rule, file, "configuration changed");
        continue;
      }
      if (rule.addedLine) {
        const hit = getDiff().added.find((l) => rule.addedLine.test(l));
        if (hit) push(rule, file, hit.trim());
      }
      if (rule.assertionLine && !deleted) {
        const { added, removed } = getDiff();
        const lost = removed.filter((l) => rule.assertionLine.test(l)).length - added.filter((l) => rule.assertionLine.test(l)).length;
        if (lost > 0) push(rule, file, `${lost} assertion line(s) removed net`);
      }
    }

    const baselineKind = policy.raw.baselines?.[file];
    const baselineRule = policy.riskRules.find((r) => r.baseline);
    if (baselineKind && baselineRule) {
      for (const detail of baselineWeakening(baselineKind, before, after)) push(baselineRule, file, detail, `:${detail.replace(/ \d+->\d+$/u, "")}`);
    }
  }
  return findings;
}

const parse = (text) => {
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** Pure: how a baseline was weakened (empty when it only shrank or is unchanged). */
export function baselineWeakening(kind, beforeText, afterText) {
  const before = parse(beforeText);
  const after = parse(afterText);
  if (beforeText === afterText) return [];
  if (after === undefined) return ["unparseable baseline"];
  if (after === null) return ["baseline deleted"];
  if (before === null || before === undefined) return ["new baseline file"];
  const out = [];
  if (kind === "go_skips") {
    if ((after.min_passed_tests ?? 0) < (before.min_passed_tests ?? 0)) out.push(`min_passed_tests lowered ${before.min_passed_tests}->${after.min_passed_tests}`);
    for (const id of Object.keys(after.allowed_skips ?? {})) if (!(id in (before.allowed_skips ?? {}))) out.push(`allowed_skip_added ${id}`);
  } else if (kind === "frontend_debt") {
    const bv = before.eslint?.violations ?? {};
    for (const [file, rules] of Object.entries(after.eslint?.violations ?? {})) {
      for (const [rule, n] of Object.entries(rules)) if (n > (bv[file]?.[rule] ?? 0)) out.push(`lint_debt_added ${file} [${rule}]`);
    }
    for (const key of ["known_failures", "known_skipped"]) {
      const b = new Set(before.vitest?.[key] ?? []);
      for (const id of after.vitest?.[key] ?? []) if (!b.has(id)) out.push(`${key}_added ${id}`);
    }
    for (const [section, key] of [["eslint", "min_linted_files"], ["vitest", "min_test_files"], ["vitest", "min_tests"]]) {
      if ((after[section]?.[key] ?? 0) < (before[section]?.[key] ?? 0)) out.push(`${key}_lowered ${before[section][key]}->${after[section][key]}`);
    }
  } else if (kind === "sql_conformance") {
    if ((after.min_statements_checked ?? 0) < (before.min_statements_checked ?? 0)) {
      out.push(`min_statements_checked_lowered ${before.min_statements_checked}->${after.min_statements_checked}`);
    }
    for (const [id, n] of Object.entries(after.known_drift ?? {})) {
      if (n > (before.known_drift?.[id] ?? 0)) out.push(`drift_added ${id}`);
    }
  }
  return out;
}
