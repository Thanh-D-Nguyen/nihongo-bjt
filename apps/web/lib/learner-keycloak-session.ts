/**
 * Coalesces concurrent GET /api/auth/keycloak/session calls.
 * The homepage and other clients fire many parallel learnerApiFetchOptional requests;
 * without this, each would probe the session endpoint separately (401 storm when guest).
 */

export type LearnerKeycloakSessionResult =
  | { ok: true; accessToken: string }
  | { ok: false; status: number };

let inFlight: Promise<LearnerKeycloakSessionResult> | null = null;

function fetchSessionOnce(): Promise<LearnerKeycloakSessionResult> {
  return fetch("/api/auth/keycloak/session", {
    cache: "no-store",
    credentials: "same-origin"
  }).then(async (r) => {
    if (!r.ok) {
      return { ok: false as const, status: r.status };
    }
    const j = (await r.json()) as { accessToken: string };
    return { ok: true as const, accessToken: j.accessToken };
  });
}

/** Single in-flight session probe shared by all callers until it settles. */
export function getLearnerKeycloakSession(opts?: { force?: boolean }): Promise<LearnerKeycloakSessionResult> {
  if (opts?.force) {
    inFlight = null;
  }
  if (!inFlight) {
    const p = fetchSessionOnce().finally(() => {
      if (inFlight === p) {
        inFlight = null;
      }
    });
    inFlight = p;
  }
  return inFlight;
}
