"use client";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/u, "");

/** Browser fetch has no default timeout; avoid hanging when the API is down. */
const ADMIN_API_FETCH_TIMEOUT_MS = 25_000;

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
 * Admin API fetch using Go-native session cookie authentication.
 * All requests include credentials for cross-origin cookie auth.
 * The Go API validates CSRF via Origin/Referer headers on unsafe methods.
 */
export async function adminApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const { signal: userSignal, ...restInit } = init ?? {};
  const effectiveSignal = mergeWithTimeout(userSignal, ADMIN_API_FETCH_TIMEOUT_MS);

  return fetch(url, {
    ...restInit,
    credentials: "include",
    signal: effectiveSignal
  });
}