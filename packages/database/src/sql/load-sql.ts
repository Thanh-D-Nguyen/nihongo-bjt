import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type SqlScriptCategory = "read" | "write" | "batch";

const cache = new Map<string, string>();

function assertSafeRelativePath(relativePath: string): void {
  if (relativePath.includes("..")) {
    throw new Error(`Invalid SQL relative path: ${relativePath}`);
  }
}

/** Directory containing this module: packages/database/src/sql */
function defaultStartDir(): string {
  return dirname(fileURLToPath(import.meta.url));
}

/**
 * Resolve monorepo root (directory that contains `database/scripts/read`).
 * Override with env `NIHONGO_BJT_REPO_ROOT` when the package is relocated (e.g. bundled without `database/`).
 */
export function resolveMonorepoRoot(options?: { startDir?: string }): string {
  const env = process.env.NIHONGO_BJT_REPO_ROOT?.trim();
  if (env !== undefined && env !== "") {
    const r = resolve(env);
    if (existsSync(join(r, "database", "scripts", "read"))) {
      return r;
    }
    throw new Error(
      `NIHONGO_BJT_REPO_ROOT is set but database/scripts/read was not found under ${r}`
    );
  }

  const fromSqlFile = join(defaultStartDir(), "..", "..", "..", "..");
  if (existsSync(join(fromSqlFile, "database", "scripts", "read"))) {
    return resolve(fromSqlFile);
  }

  let dir = resolve(options?.startDir ?? process.cwd());
  for (let i = 0; i < 24; i++) {
    if (existsSync(join(dir, "database", "scripts", "read"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  throw new Error(
    "Could not find monorepo root (folder with database/scripts/read). Set NIHONGO_BJT_REPO_ROOT."
  );
}

export function resolveSqlFilePath(
  category: SqlScriptCategory,
  relativePath: string,
  options?: { root?: string; startDir?: string }
): string {
  assertSafeRelativePath(relativePath);
  const root = options?.root ?? resolveMonorepoRoot({ startDir: options?.startDir });
  const full = join(root, "database", "scripts", category, relativePath);
  if (!existsSync(full)) {
    throw new Error(`SQL file not found: ${full}`);
  }
  const rel = relative(root, full);
  if (rel.startsWith("..")) {
    throw new Error(`Resolved SQL path escapes repo root: ${full}`);
  }
  return full;
}

export function loadSqlFileSync(
  category: SqlScriptCategory,
  relativePath: string,
  options?: { root?: string; startDir?: string; useCache?: boolean }
): string {
  const useCache = options?.useCache ?? true;
  const path = resolveSqlFilePath(category, relativePath, options);
  const key = path;
  if (useCache && cache.has(key)) {
    return cache.get(key)!;
  }
  const text = readFileSync(path, "utf8");
  if (useCache) {
    cache.set(key, text);
  }
  return text;
}

export async function loadSqlFile(
  category: SqlScriptCategory,
  relativePath: string,
  options?: { root?: string; startDir?: string; useCache?: boolean }
): Promise<string> {
  const useCache = options?.useCache ?? true;
  const path = resolveSqlFilePath(category, relativePath, options);
  if (useCache && cache.has(path)) {
    return cache.get(path)!;
  }
  const text = await readFile(path, "utf8");
  if (useCache) {
    cache.set(path, text);
  }
  return text;
}

/** Test-only: clear in-memory SQL cache */
export function clearSqlFileCache(): void {
  cache.clear();
}
