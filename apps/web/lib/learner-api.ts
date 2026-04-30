"use client";

import { isWebKeycloakEnabled } from "./public-keycloak";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/u, "");

export class LearnerSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LearnerSessionError";
  }
}

/**
 * Same-origin session cookie → Bearer for cross-origin API calls when Keycloak is enabled.
 * Falls back to unauthenticated fetch when Keycloak env is not set (legacy local dev).
 */
export async function learnerApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init?.headers);
  if (isWebKeycloakEnabled()) {
    const sr = await fetch("/api/auth/keycloak/session", { credentials: "same-origin" });
    if (!sr.ok) {
      throw new LearnerSessionError("learner_session_unauthorized");
    }
    const { accessToken } = (await sr.json()) as { accessToken: string };
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return fetch(url, { ...init, headers });
}

/**
 * When Keycloak is enabled, attaches Bearer only if a browser session exists.
 * Use for endpoints that allow anonymous access but should prefer the logged-in user when present.
 */
export async function learnerApiFetchOptional(path: string, init?: RequestInit): Promise<Response> {
  const url = `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init?.headers);
  if (isWebKeycloakEnabled()) {
    const sr = await fetch("/api/auth/keycloak/session", { credentials: "same-origin" });
    if (sr.ok) {
      const { accessToken } = (await sr.json()) as { accessToken: string };
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }
  return fetch(url, { ...init, headers });
}
