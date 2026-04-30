"use client";

import { isAdminKeycloakEnabled } from "./public-keycloak";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/u, "");
const localAdminActorId =
  process.env.NEXT_PUBLIC_LOCAL_ADMIN_ACTOR_ID ?? "00000000-0000-4000-8000-000000000001";

/** Browser fetch has no default timeout; avoid hanging when the API is down. */
const KEYCLOAK_SESSION_FETCH_TIMEOUT_MS = 12_000;
const ADMIN_API_FETCH_TIMEOUT_MS = 25_000;
/** Reuse the same access token for parallel overview requests (avoid N× /api/auth/keycloak/session). */
const KEYCLOAK_ACCESS_TOKEN_CACHE_MS = 20_000;

type Cached = { accessToken: string; cachedAt: number };
let keycloakTokenCache: Cached | null = null;
let inFlightKeycloakToken: Promise<string> | null = null;

function keycloakBearerMode() {
  return isAdminKeycloakEnabled();
}

function invalidateKeycloakTokenCache() {
  keycloakTokenCache = null;
}

function mergeWithTimeout(
  userSignal: AbortSignal | null | undefined,
  timeoutMs: number
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (userSignal == null) {
    return timeout;
  }
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
    return AbortSignal.any([userSignal, timeout]);
  }
  return timeout;
}

/**
 * Deduplicate concurrent callers and short-TTL cache so one page load only hits
 * the Next session route once for multiple adminApiFetch calls.
 */
async function getKeycloakAccessTokenCached(): Promise<string> {
  if (!keycloakBearerMode()) {
    throw new Error("admin_session_unauthorized");
  }
  const now = Date.now();
  if (keycloakTokenCache && now - keycloakTokenCache.cachedAt < KEYCLOAK_ACCESS_TOKEN_CACHE_MS) {
    return keycloakTokenCache.accessToken;
  }
  if (inFlightKeycloakToken) {
    return inFlightKeycloakToken;
  }
  inFlightKeycloakToken = (async () => {
    try {
      const sr = await fetch("/api/auth/keycloak/session", {
        credentials: "same-origin",
        signal: AbortSignal.timeout(KEYCLOAK_SESSION_FETCH_TIMEOUT_MS)
      });
      if (!sr.ok) {
        throw new Error("admin_session_unauthorized");
      }
      const { accessToken } = (await sr.json()) as { accessToken: string };
      keycloakTokenCache = { accessToken, cachedAt: Date.now() };
      return accessToken;
    } finally {
      inFlightKeycloakToken = null;
    }
  })();
  return inFlightKeycloakToken;
}

export async function adminApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const { signal: userSignal, ...restInit } = init ?? {};
  const effectiveSignal = mergeWithTimeout(userSignal, ADMIN_API_FETCH_TIMEOUT_MS);

  const doOnce = async (): Promise<Response> => {
    const headers = new Headers(init?.headers);
    if (keycloakBearerMode()) {
      const accessToken = await getKeycloakAccessTokenCached();
      headers.set("Authorization", `Bearer ${accessToken}`);
    } else if (!headers.has("x-admin-actor-id")) {
      headers.set("x-admin-actor-id", localAdminActorId);
    }
    return fetch(url, { ...restInit, headers, signal: effectiveSignal });
  };

  let res = await doOnce();
  if (res.status === 401 && keycloakBearerMode()) {
    invalidateKeycloakTokenCache();
    res = await doOnce();
  }
  return res;
}
