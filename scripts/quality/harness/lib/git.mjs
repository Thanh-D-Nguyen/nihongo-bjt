// Git helpers. Artifact identity is always an immutable object id (commit,
// tree or blob), never a branch name.
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, readdirSync, readlinkSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { sha256, toolFailure } from "./util.mjs";

export function git(root, args, { allowFail = false, input, env } = {}) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    input,
    env: env ? { ...process.env, ...env } : process.env,
    maxBuffer: 512 * 1024 * 1024
  });
  if (result.error) throw toolFailure(`git ${args.join(" ")} could not run: ${result.error.message}`);
  if (result.status !== 0 && !allowFail) {
    throw toolFailure(`git ${args.join(" ")} failed (exit ${result.status}): ${result.stderr.trim()}`);
  }
  return result;
}

const zsplit = (out) => out.split("\0").filter(Boolean);

export const toplevel = (cwd) => git(cwd, ["rev-parse", "--show-toplevel"]).stdout.trim();
export const headSha = (root) => git(root, ["rev-parse", "HEAD"]).stdout.trim();

export function resolveCommit(root, rev) {
  const r = git(root, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`], { allowFail: true });
  if (r.status !== 0) throw toolFailure(`cannot resolve commit ${JSON.stringify(rev)}`);
  return r.stdout.trim();
}

export const commitExists = (root, rev) =>
  git(root, ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`], { allowFail: true }).status === 0;

/** Paths that differ between `rev` and the working tree: tracked changes + untracked, non-ignored files. */
export function changedSinceRev(root, rev) {
  const tracked = zsplit(git(root, ["diff", "--name-only", "-z", "--no-renames", rev]).stdout);
  const untracked = zsplit(git(root, ["ls-files", "--others", "--exclude-standard", "-z"]).stdout);
  return [...new Set([...tracked, ...untracked])].sort();
}

export const isAncestor = (root, maybeAncestor, rev) =>
  commitExists(root, maybeAncestor) && git(root, ["merge-base", "--is-ancestor", maybeAncestor, rev], { allowFail: true }).status === 0;

export const changedBetween = (root, base, head) =>
  zsplit(git(root, ["diff", "--name-only", "-z", "--no-renames", base, head]).stdout).sort();

/** Working-tree paths with uncommitted changes (porcelain), including untracked files. */
export function dirtyPaths(root) {
  const out = git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--no-renames"]).stdout;
  return zsplit(out).map((entry) => entry.slice(3)).sort();
}

/** Inspect a Git path without traversing a symlink in any parent component. */
export function worktreeStat(root, file) {
  const parts = file.split("/");
  let current = root;
  try {
    for (let i = 0; i < parts.length; i++) {
      current = path.join(current, parts[i]);
      const stat = lstatSync(current);
      if (i === parts.length - 1) return stat;
      if (!stat.isDirectory()) return null;
    }
  } catch (error) {
    if (!["ENOENT", "ENOTDIR"].includes(error.code)) throw error;
  }
  return null;
}

/** Blob ids of working-tree files and symlinks (null when absent). */
export function worktreeBlobs(root, paths) {
  const result = {};
  const present = [];
  for (const p of paths) {
    const abs = path.join(root, p);
    const stat = worktreeStat(root, p);
    if (!stat) {
      result[p] = null;
      continue;
    }
    if (stat.isSymbolicLink()) result[p] = `symlink:${git(root, ["hash-object", "--stdin"], { input: readlinkSync(abs) }).stdout.trim()}`;
    else if (stat.isFile()) present.push(p);
    else result[p] = null;
  }
  if (present.length) {
    const ids = git(root, ["hash-object", "--stdin-paths"], { input: `${present.join("\n")}\n` }).stdout.trim().split("\n");
    if (ids.length !== present.length) throw toolFailure("git hash-object returned an unexpected number of ids");
    present.forEach((p, i) => (result[p] = ids[i]));
  }
  return result;
}

/** Blob ids of paths at a commit (null when absent). */
export function blobsAt(root, rev, paths) {
  const result = Object.fromEntries(paths.map((p) => [p, null]));
  if (!paths.length) return result;
  const out = git(root, ["--literal-pathspecs", "ls-tree", "-r", "-z", "--full-tree", rev, "--", ...paths]).stdout;
  for (const entry of zsplit(out)) {
    const separator = entry.indexOf("\t");
    const meta = entry.slice(0, separator);
    const file = entry.slice(separator + 1);
    const [mode, type, id] = meta.split(" ");
    if (type === "blob" && file in result) result[file] = mode === "120000" ? `symlink:${id}` : id;
  }
  return result;
}

export function showFile(root, rev, file) {
  const id = blobsAt(root, rev, [file])[file];
  return id === null ? null : git(root, ["cat-file", "blob", id.replace(/^symlink:/u, "")]).stdout;
}

/** sha256 over sorted `path NUL blob` lines; the content identity of a set of files. */
export function fingerprint(blobs) {
  const lines = Object.keys(blobs)
    .sort()
    .map((p) => `${p}\0${blobs[p] ?? "-"}`);
  return sha256(lines.join("\n"));
}

/**
 * Commit object for the current working tree (tracked + untracked, non-ignored),
 * built with a temporary index so the real index, HEAD and files are untouched.
 */
export function snapshotWorktree(root) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "quality-index-"));
  try {
    const env = { GIT_INDEX_FILE: path.join(dir, "index") };
    git(root, ["read-tree", "HEAD"], { env });
    git(root, ["add", "-A", "--", "."], { env });
    const tree = git(root, ["write-tree"], { env }).stdout.trim();
    return git(root, ["commit-tree", tree, "-p", "HEAD", "-m", "quality-harness worktree snapshot"], {
      env: { GIT_AUTHOR_NAME: "quality-harness", GIT_AUTHOR_EMAIL: "harness@localhost", GIT_COMMITTER_NAME: "quality-harness", GIT_COMMITTER_EMAIL: "harness@localhost" }
    }).stdout.trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Run `fn(scratchRoot)` in a disposable detached worktree at `commit`. The
 * user's working tree is never modified. node_modules directories are
 * symlinked so JS test runners resolve dependencies.
 */
export function withScratchWorktree(root, commit, fn) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "quality-wt-"));
  const wt = path.join(dir, "tree");
  git(root, ["worktree", "add", "--detach", "--quiet", wt, commit]);
  try {
    for (const rel of nodeModulesDirs(root)) {
      const target = path.join(wt, rel);
      if (!existsSync(target)) symlinkSync(path.join(root, rel), target, "dir");
    }
    return fn(wt);
  } finally {
    git(root, ["worktree", "remove", "--force", wt], { allowFail: true });
    git(root, ["worktree", "prune"], { allowFail: true });
    rmSync(dir, { recursive: true, force: true });
  }
}

function nodeModulesDirs(root) {
  const dirs = [];
  const candidates = ["node_modules"];
  for (const parent of ["apps", "packages"]) {
    const abs = path.join(root, parent);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs)) candidates.push(`${parent}/${name}/node_modules`);
  }
  for (const rel of candidates) if (existsSync(path.join(root, rel))) dirs.push(rel);
  return dirs;
}
