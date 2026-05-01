/**
 * Server-computed content diff utilities.
 *
 * - Strings (text fields) → unified line-based diff using LCS, returning {added, removed, context}.
 * - JSON snapshots (structured payload) → recursive object diff returning a flat path-based change list.
 *
 * No external diff library; small implementation tuned for admin UI rendering.
 */

export type LineDiffOp = "context" | "added" | "removed";

export type LineDiffEntry = {
  op: LineDiffOp;
  /** 1-based line number in the "from" snapshot (null when added). */
  fromLine: number | null;
  /** 1-based line number in the "to" snapshot (null when removed). */
  toLine: number | null;
  text: string;
};

export type ObjectDiffOp = "added" | "removed" | "changed";

export type ObjectDiffEntry = {
  path: string;
  op: ObjectDiffOp;
  before?: unknown;
  after?: unknown;
};

/** Compute a unified line-based diff from two strings. */
export function diffText(from: string, to: string): LineDiffEntry[] {
  const a = (from ?? "").split(/\r?\n/);
  const b = (to ?? "").split(/\r?\n/);
  // LCS length matrix.
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: LineDiffEntry[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ fromLine: i + 1, op: "context", text: a[i], toLine: j + 1 });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ fromLine: i + 1, op: "removed", text: a[i], toLine: null });
      i++;
    } else {
      out.push({ fromLine: null, op: "added", text: b[j], toLine: j + 1 });
      j++;
    }
  }
  while (i < n) {
    out.push({ fromLine: i + 1, op: "removed", text: a[i], toLine: null });
    i++;
  }
  while (j < m) {
    out.push({ fromLine: null, op: "added", text: b[j], toLine: j + 1 });
    j++;
  }
  return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a).sort();
    const bk = Object.keys(b).sort();
    if (ak.length !== bk.length) return false;
    for (let i = 0; i < ak.length; i++) {
      if (ak[i] !== bk[i]) return false;
      if (!deepEqual(a[ak[i]], b[bk[i]])) return false;
    }
    return true;
  }
  return false;
}

/** Recursive object diff. Treats arrays as opaque values (changed if not deep-equal). */
export function diffJson(before: unknown, after: unknown, basePath = ""): ObjectDiffEntry[] {
  const out: ObjectDiffEntry[] = [];
  if (deepEqual(before, after)) return out;

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
    for (const k of Array.from(keys).sort()) {
      const path = basePath === "" ? k : `${basePath}.${k}`;
      const b = before[k];
      const a = after[k];
      const inBefore = Object.prototype.hasOwnProperty.call(before, k);
      const inAfter = Object.prototype.hasOwnProperty.call(after, k);
      if (inBefore && !inAfter) {
        out.push({ before: b, op: "removed", path });
      } else if (!inBefore && inAfter) {
        out.push({ after: a, op: "added", path });
      } else if (!deepEqual(b, a)) {
        if (isPlainObject(b) && isPlainObject(a)) {
          out.push(...diffJson(b, a, path));
        } else {
          out.push({ after: a, before: b, op: "changed", path });
        }
      }
    }
    return out;
  }

  out.push({ after, before, op: "changed", path: basePath || "$" });
  return out;
}

/** Convenience helper that returns both representations for snapshots stored as JSON. */
export function diffSnapshots(
  fromSnapshot: unknown,
  toSnapshot: unknown
): { json: ObjectDiffEntry[]; jsonText: { from: string; to: string; lines: LineDiffEntry[] } } {
  const fromText = stableStringify(fromSnapshot);
  const toText = stableStringify(toSnapshot);
  return {
    json: diffJson(fromSnapshot, toSnapshot),
    jsonText: { from: fromText, lines: diffText(fromText, toText), to: toText }
  };
}

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const replace = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v as object)) return "[Circular]";
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(replace);
    const obj = v as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) sorted[k] = replace(obj[k]);
    return sorted;
  };
  return JSON.stringify(replace(value), null, 2);
}
