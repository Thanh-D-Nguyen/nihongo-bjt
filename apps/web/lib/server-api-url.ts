import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

let monorepoRootEnvLoaded = false;

/** `apps/web/lib` → monorepo root */
function monorepoRootFromHere(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

/**
 * Next may evaluate route handlers before / without full root env merge; reload here idempotently.
 */
function ensureMonorepoRootEnvLoaded(): void {
  if (monorepoRootEnvLoaded) {
    return;
  }
  monorepoRootEnvLoaded = true;
  const root = monorepoRootFromHere();
  loadDotenv({ path: path.join(root, ".env") });
  loadDotenv({ path: path.join(root, ".env.local"), override: true });
}

/** Node fetch often prefers `::1` for `localhost`; many dev servers listen on IPv4 only. */
function preferIpv4LoopbackInUrl(url: string): string {
  return url.replace(/^(https?:\/\/)localhost(?=[:/]|$)/iu, "$1127.0.0.1");
}

export type ServerApiUrlSource = "API_URL" | "WEB_API_URL" | "INTERNAL_API_URL" | "NEXT_PUBLIC_API_URL" | "default";

let lastResolution: { baseUrl: string; source: ServerApiUrlSource } | null = null;

export function getLastServerApiResolution(): typeof lastResolution {
  return lastResolution;
}

/**
 * Nest API base URL for **server-side** calls from Next (route handlers, RSC).
 * - Prefer `API_URL` / `WEB_API_URL` / `INTERNAL_API_URL`, then `NEXT_PUBLIC_API_URL`.
 * - Merges monorepo root `.env` / `.env.local` on first call (same paths as `next.config.mjs`).
 * - Rewrites `http(s)://localhost` → `127.0.0.1` to reduce IPv6 loopback connection failures.
 */
export function getServerApiBaseUrl(): string {
  ensureMonorepoRootEnvLoaded();

  let raw: string;
  let source: ServerApiUrlSource;
  const a = process.env.API_URL?.trim();
  const w = process.env.WEB_API_URL?.trim();
  const i = process.env.INTERNAL_API_URL?.trim();
  const n = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (a) {
    raw = a;
    source = "API_URL";
  } else if (w) {
    raw = w;
    source = "WEB_API_URL";
  } else if (i) {
    raw = i;
    source = "INTERNAL_API_URL";
  } else if (n) {
    raw = n;
    source = "NEXT_PUBLIC_API_URL";
  } else {
    raw = "http://localhost:4000";
    source = "default";
  }

  const baseUrl = preferIpv4LoopbackInUrl(raw.replace(/\/$/u, ""));
  lastResolution = { baseUrl, source };
  return baseUrl;
}
