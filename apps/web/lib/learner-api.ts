"use client";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/u, "");

export class LearnerSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LearnerSessionError";
  }
}

/**
 * Cookie-based fetch for cross-origin API calls.
 * Go-native auth uses HttpOnly session cookies (bjt_web_session) — no Bearer tokens needed.
 */
export async function learnerApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, { ...init, credentials: "include" });
}

/**
 * Same as learnerApiFetch but semantically indicates the endpoint allows anonymous access.
 * Cookies are still sent so the server can identify the user when present.
 */
export async function learnerApiFetchOptional(path: string, init?: RequestInit): Promise<Response> {
  const url = `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, { ...init, credentials: "include" });
}