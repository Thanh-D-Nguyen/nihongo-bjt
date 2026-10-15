// RED/GREEN/sensitivity replay. This is what turns VALID_RED from a claim into
// machine-verified evidence: with the task's production files restored to the
// base commit, every red target must execute and fail for its declared reason;
// on the final code every target must pass; under the recorded mutation every
// sensitivity target must fail. Runs in a disposable tree (scratch worktree
// locally; the CI checkout in CI) — the developer's files are never mutated.
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { blobsAt, changedBetween, dirtyPaths, git, headSha, isAncestor, showFile, snapshotWorktree, withScratchWorktree } from "./git.mjs";
import { pathRule, requiredGates } from "./policy.mjs";
import { judgeGreen, judgeRed, runTargets } from "./runners.mjs";
import { greenTargets, replayRevertPaths, sensitivityTargets, validateMutation } from "./task.mjs";
import { toolFailure, violation } from "./util.mjs";

/** Put `paths` back to their content at `base` (deleting files that did not exist there). */
export function revertToBase(treeRoot, base, paths) {
  for (const p of paths) {
    const content = showFile(treeRoot, base, p);
    const abs = path.join(treeRoot, p);
    if (content === null) rmSync(abs, { force: true });
    else {
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, content);
    }
  }
}

/** Apply a recorded mutation; the `find` text must occur exactly once. */
export function applyMutation(treeRoot, mutation, policy) {
  const problems = policy ? validateMutation(policy, mutation) : [];
  if (problems.length) throw violation(problems.join("; "));
  const abs = path.resolve(treeRoot, mutation.file);
  if (!abs.startsWith(`${path.resolve(treeRoot)}${path.sep}`)) throw violation(`mutation file escapes the tree: ${mutation.file}`);
  if (!existsSync(abs)) throw violation(`sensitivity mutation file not found: ${mutation.file}`);
  const text = readFileSync(abs, "utf8");
  const count = text.split(mutation.find).length - 1;
  if (count !== 1) throw violation(`sensitivity mutation "find" must occur exactly once in ${mutation.file} (found ${count})`);
  writeFileSync(abs, text.replace(mutation.find, mutation.replace));
}

export function runRedAgainstBase(treeRoot, policy, task, base, revertPaths, env) {
  revertToBase(treeRoot, base, revertPaths);
  const run = runTargets(treeRoot, policy, task.red_targets, env);
  return { ...run, judgement: judgeRed(policy, task.red_targets, run.results) };
}

export function runSensitivity(treeRoot, policy, task, env) {
  applyMutation(treeRoot, task.sensitivity.mutation, policy);
  const targets = sensitivityTargets(task);
  const run = runTargets(treeRoot, policy, targets, env);
  // Same judgement as RED: executed, failed, failure contains the declared
  // assertion text, no infra signature. Compile failures and crashes prove nothing.
  const judgement = judgeRed(policy, targets, run.results);
  return { commands: run.commands, targets: judgement.targets.map((t) => ({ id: t.id, outcome: t.outcome, valid: t.valid, reason: t.reason })), outcome: judgement.valid ? "SENSITIVE" : "INSENSITIVE" };
}

/**
 * Replay one closed task. `treeRoot` must be a disposable checkout of the head
 * commit. Returns { steps: [{step, ok, detail}] }.
 */
export function replayTaskInTree(treeRoot, policy, task, base, diffPaths, env = {}) {
  const steps = [];
  const files = Object.keys(task.closed?.files ?? {});
  const { gates } = requiredGates(policy, task, files);
  const inDiff = new Set(diffPaths);
  const revertPaths = replayRevertPaths(policy, files).filter((p) => inDiff.has(p));
  const restore = (paths) => {
    for (const p of paths) {
      if (showFile(treeRoot, "HEAD", p) === null) rmSync(path.join(treeRoot, p), { force: true });
      else git(treeRoot, ["checkout", "HEAD", "--", p]);
    }
  };

  if (gates.has("red")) {
    if (!revertPaths.length) {
      steps.push({ step: "red", ok: false, detail: "red is required but the task changes no revertible production file — a RED cannot be demonstrated" });
    } else {
      const red = runRedAgainstBase(treeRoot, policy, task, base, revertPaths, env);
      restore(revertPaths);
      const bad = red.judgement.targets.filter((t) => !t.valid);
      steps.push({
        step: "red",
        ok: red.judgement.valid,
        detail: red.judgement.valid
          ? `${red.judgement.targets.length} target(s) fail against base production code (${revertPaths.length} file(s) reverted)`
          : bad.map((t) => `${t.id}: ${t.outcome} — ${t.reason}`).join("; ")
      });
    }
  }
  if (gates.has("sensitivity")) {
    const s = runSensitivity(treeRoot, policy, task, env);
    restore([task.sensitivity.mutation.file]);
    steps.push({
      step: "sensitivity",
      ok: s.outcome === "SENSITIVE",
      detail: s.outcome === "SENSITIVE" ? `${s.targets.length} target(s) fail under the mutation` : s.targets.filter((t) => !t.valid).map((t) => `${t.id}: ${t.outcome} — ${t.reason}`).join("; ")
    });
  }
  if (gates.has("green")) {
    const targets = greenTargets(task);
    const run = runTargets(treeRoot, policy, targets, env);
    const g = judgeGreen(targets, run.results);
    steps.push({
      step: "green",
      ok: g.valid,
      detail: g.valid ? `${targets.length} target(s) pass on the final code` : g.targets.filter((t) => !t.valid).map((t) => `${t.id}: ${t.outcome}`).join("; ")
    });
  }
  return { steps };
}

/**
 * Replay every closed task at the first commit carrying its closed artifacts.
 * Later record edits cannot move its replay onto another task's implementation.
 * Retained production also gets final-tree GREEN/sensitivity checks, so later
 * test changes cannot weaken the verified assertions. Missing historical
 * artifacts fail closed (including dependent tasks squashed together).
 * Runs in scratch worktrees; with `inPlace`
 * (CI) a task closed at HEAD is replayed in the clean checkout itself.
 */
export function replayAll(root, policy, { base, head, tasks, inPlace, env = {} }) {
  if (inPlace && dirtyPaths(root).length) throw toolFailure("in-place replay needs a clean checkout (it temporarily rewrites files)");
  const headCommit = head === "WORKTREE" ? snapshotWorktree(root) : git(root, ["rev-parse", head]).stdout.trim();
  const allFiles = [...new Set(tasks.flatMap((t) => [...Object.keys(t.closed?.files ?? {}), ...(t.sensitivity?.mutation?.file ? [t.sensitivity.mutation.file] : [])]))];
  const merged = blobsAt(root, headCommit, allFiles);
  const results = [];
  for (const task of tasks) {
    const record = `${policy.raw.harness.tasks_dir}/${task.id}.json`;
    const files = Object.keys(task.closed?.files ?? {});
    const commits = git(root, ["log", "--reverse", "--format=%H", `${base}..${headCommit}`, "--", record]).stdout.trim().split("\n").filter(Boolean);
    const commit = commits.find((candidate) => {
      const recorded = JSON.parse(showFile(root, candidate, record) ?? "null");
      if (recorded?.closed?.fingerprint !== task.closed.fingerprint) return false;
      const blobs = blobsAt(root, candidate, files);
      return files.every((p) => blobs[p] === task.closed.files[p]);
    });
    if (!commit) {
      results.push({
        id: task.id,
        steps: [{ step: "replay", ok: false, detail: "no historical closing commit matches the task's closed artifacts (squashed/dependent tasks need their intermediate commits)" }]
      });
      continue;
    }
    const diffPaths = changedBetween(root, base, commit);
    // RED is "before this task": its own start_head when that is inside the range history, else the range base.
    // Works for PRs behind main: start_head only has to lie between the fork point and the closing commit.
    const forkPoint = git(root, ["merge-base", base, commit], { allowFail: true }).stdout.trim();
    const taskBase = task.start_head && forkPoint && isAncestor(root, forkPoint, task.start_head) && isAncestor(root, task.start_head, commit) ? task.start_head : base;
    const replay = (treeRoot) => replayTaskInTree(treeRoot, policy, task, taskBase, diffPaths, env);
    let r;
    if (inPlace && commit === headSha(root)) {
      r = replay(root);
      if (dirtyPaths(root).length) throw toolFailure(`replay left the checkout dirty: ${dirtyPaths(root).join(", ")}`);
    } else {
      r = withScratchWorktree(root, commit, replay);
    }
    const { gates } = requiredGates(policy, task, files);
    const retained = files.some((p) => pathRule(policy, p).production && merged[p] === task.closed.files[p]);
    const mutationFile = task.sensitivity?.mutation?.file;
    const retainedMutation = gates.has("sensitivity") && merged[mutationFile] === blobsAt(root, commit, [mutationFile])[mutationFile];
    if (commit !== headCommit && (retained || retainedMutation)) {
      const final = withScratchWorktree(root, headCommit, (treeRoot) => {
        const steps = [];
        if (retainedMutation) {
          const s = runSensitivity(treeRoot, policy, task, env);
          revertToBase(treeRoot, headCommit, [mutationFile]);
          steps.push({ step: "final_sensitivity", ok: s.outcome === "SENSITIVE", detail: `${s.outcome}: ${s.targets.map((t) => `${t.id}: ${t.outcome}`).join("; ")}` });
        }
        if (gates.has("green")) {
          const targets = greenTargets(task);
          const run = runTargets(treeRoot, policy, targets, env);
          const g = judgeGreen(targets, run.results);
          steps.push({ step: "final_green", ok: g.valid, detail: g.targets.map((t) => `${t.id}: ${t.outcome}`).join("; ") });
        }
        return steps;
      });
      r = { ...r, steps: [...r.steps, ...final] };
    }
    results.push({ id: task.id, commit, base: taskBase, ...r });
  }
  return results;
}
