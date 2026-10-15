// Shared helpers for the engineering-lifecycle harness. No dependencies.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Exit codes shared by every harness command (same contract as the debt ratchets). */
export const EXIT = Object.freeze({ PASS: 0, VIOLATION: 1, TOOL_FAILURE: 2 });

/**
 * A harness error carries the exit code it maps to. VIOLATION = the work does
 * not satisfy the policy; TOOL_FAILURE = the harness or a tool it drives could
 * not produce a trustworthy answer (never treated as PASS or as known debt).
 */
export class HarnessError extends Error {
  constructor(message, code = EXIT.VIOLATION, details = []) {
    super(message);
    this.name = "HarnessError";
    this.code = code;
    this.details = details;
  }
}

export const toolFailure = (message, details) => new HarnessError(message, EXIT.TOOL_FAILURE, details);
export const violation = (message, details) => new HarnessError(message, EXIT.VIOLATION, details);

export const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/** Minimal glob -> RegExp: `**` (any depth), `*` (one segment), `?`, `{a,b}` literal alternation. */
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        if (glob[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (c === "{") {
      const end = glob.indexOf("}", i);
      if (end === -1) throw toolFailure(`unterminated { in glob ${glob}`);
      const alternatives = glob.slice(i + 1, end).split(",").map((a) => a.replace(/[.*+?^$()|[\]\\]/g, "\\$&"));
      re += `(?:${alternatives.join("|")})`;
      i = end;
    } else {
      re += c.replace(/[.+^$()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

export const compileGlobs = (globs) => globs.map(globToRegExp);
export const matchesAny = (relPath, regexps) => regexps.some((re) => re.test(relPath));

const SECRET_PATTERNS = [
  [/([a-z][a-z0-9+.-]*:\/\/)[^\s:@/]+:[^\s@/]+@/gi, "$1***:***@"],
  [/\b(bearer)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 ***"],
  [/\b(password|passwd|secret|token|api[_-]?key|authorization|cookie|set-cookie|session[_-]?id)(["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;]+)/gi, "$1$2***"],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "***jwt***"],
  [/\b(?:ghp|gho|ghs|github_pat|sk|xox[abp])[-_][A-Za-z0-9_-]{16,}/g, "***token***"]
];

/** Redact credentials/tokens and bound the length of any text stored as evidence. */
export function redact(text, max = 400) {
  let out = String(text ?? "");
  for (const [pattern, replacement] of SECRET_PATTERNS) out = out.replace(pattern, replacement);
  out = out.replace(/\s+/g, " ").trim();
  return out.length > max ? `${out.slice(0, max)}…` : out;
}

export function readJson(file, label = file) {
  if (!existsSync(file)) throw toolFailure(`${label} not found (${file})`);
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw toolFailure(`${label} is not valid JSON: ${error.message}`);
  }
}

/** Atomic, stable JSON write (2-space indent, trailing newline). */
export function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, file);
}

export const nowIso = () => new Date().toISOString();
export const unique = (items) => [...new Set(items)];
export const toPosix = (p) => p.split(path.sep).join("/");
