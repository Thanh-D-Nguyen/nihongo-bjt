// Stale-reference scan for deleted symbols/routes. Deterministic, so CI
// recomputes it on the merged tree instead of trusting recorded evidence.
import { git } from "./git.mjs";
import { toolFailure } from "./util.mjs";

/**
 * @param tree commit/tree-ish to scan, or null for the working tree (incl. untracked files)
 * @returns {{symbol: string, path: string, line: number}[]}
 */
export function staleReferences(root, policy, deletion, tree = null) {
  const allowed = new Set((deletion?.allowed_references ?? []).filter((a) => a.reason).map((a) => a.path));
  const hits = [];
  for (const sym of deletion?.symbols ?? []) {
    const word = /^[A-Za-z_][A-Za-z0-9_]*$/u.test(sym) ? ["-w"] : [];
    const opts = tree ? [] : ["--untracked"];
    const r = git(root, ["grep", "-n", "-I", "-F", ...word, ...opts, "-e", sym, ...(tree ? [tree] : []), "--", ".", `:(exclude)${policy.raw.harness.tasks_dir}`], { allowFail: true });
    if (r.status > 1) throw toolFailure(`git grep failed: ${r.stderr}`);
    for (const line of r.stdout.split("\n").filter(Boolean)) {
      const parts = line.split(":");
      if (tree) parts.shift(); // "<tree>:<path>:<line>:..."
      const [file, lineNo] = parts;
      if (!allowed.has(file)) hits.push({ symbol: sym, path: file, line: Number(lineNo) });
    }
  }
  return hits;
}
