import fs from "node:fs";
import path from "node:path";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { ReadStream } from "node:fs";

/** Allowed relative prefix for repo-hosted stroke SVGs (matches DB values). */
export const KANJI_STROKE_REPO_PREFIX = "data/generated/kanji-strokes/";

/**
 * Resolves monorepo root so `data/generated/kanji-strokes/*.svg` can be opened.
 * Override with `NIHONGO_BJT_REPO_ROOT` or `KANJI_STROKE_REPO_ROOT` in production images.
 */
export function resolveStrokeRepoRoot(): string {
  const fromEnv = process.env.NIHONGO_BJT_REPO_ROOT ?? process.env.KANJI_STROKE_REPO_ROOT;
  if (fromEnv?.trim()) {
    return path.resolve(fromEnv.trim());
  }
  let dir = path.resolve(process.cwd());
  for (let i = 0; i < 10; i++) {
    const marker = path.join(dir, "pnpm-workspace.yaml");
    const strokesDir = path.join(dir, KANJI_STROKE_REPO_PREFIX.replace(/\/$/, ""));
    if (fs.existsSync(marker) || fs.existsSync(strokesDir)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(process.cwd(), "..", "..");
}

/**
 * When DB stores `data/generated/kanji-strokes/123-04fc4.svg`, open a read stream from disk.
 * Rejects path traversal and unexpected shapes (not an open file proxy).
 */
export function openKanjiStrokeRepoReadStream(dbPath: string): ReadStream {
  const raw = dbPath.trim().replace(/\\/g, "/");
  const norm = raw.replace(/^\/+/, "");
  if (!norm.startsWith(KANJI_STROKE_REPO_PREFIX)) {
    throw new BadRequestException("Stroke SVG path must be under data/generated/kanji-strokes/");
  }
  const fileName = norm.slice(KANJI_STROKE_REPO_PREFIX.length);
  if (!fileName || fileName.includes("/") || fileName.includes("..")) {
    throw new BadRequestException("Invalid stroke SVG path");
  }
  // Filenames from generator: `<digits>-<hex>.svg` (e.g. 256-04fc4.svg)
  if (!/^[0-9]+-[0-9a-f]+\.svg$/i.test(fileName)) {
    throw new BadRequestException("Invalid stroke SVG filename");
  }

  const root = resolveStrokeRepoRoot();
  const strokesDir = path.resolve(root, "data", "generated", "kanji-strokes");
  const abs = path.resolve(strokesDir, fileName);
  const rel = path.relative(strokesDir, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new BadRequestException("Invalid stroke SVG path");
  }

  if (!fs.existsSync(abs)) {
    throw new NotFoundException("Stroke SVG file not found on server");
  }

  return fs.createReadStream(abs);
}

export function isRepoRelativeKanjiStrokePath(dbPath: string): boolean {
  const norm = dbPath.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  return norm.startsWith(KANJI_STROKE_REPO_PREFIX);
}
