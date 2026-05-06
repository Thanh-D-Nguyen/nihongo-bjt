import { createHash, randomBytes } from "node:crypto";

/** HttpOnly cookie names shared by Next.js apps and documented for ops. */
export const KC_COOKIE = {
  access: "kc_access_token",
  idToken: "kc_id_token",
  pkceVerifier: "kc_pkce_verifier",
  refresh: "kc_refresh_token",
  returnTo: "kc_return_to",
  state: "kc_oauth_state"
} as const;

export type KcCookieJar = {
  access: string;
  idToken: string;
  pkceVerifier: string;
  refresh: string;
  returnTo: string;
  state: string;
};

export type KcOidcSurface = "web" | "admin";

const KC_COOKIE_PREFIX: Record<KcOidcSurface, string> = {
  /** Learner app (`apps/web`); must differ from admin when both run on `localhost`. */
  web: "bjt_web",
  admin: "bjt_admin"
};

/**
 * Per-app OAuth cookie names so learner (3000) and admin (3001) on the same host
 * do not overwrite each other's sessions.
 */
export function buildKcCookieNames(surface: KcOidcSurface): KcCookieJar {
  const pre = KC_COOKIE_PREFIX[surface];
  return {
    access: `${pre}_kc_access_token`,
    idToken: `${pre}_kc_id_token`,
    pkceVerifier: `${pre}_kc_pkce_verifier`,
    refresh: `${pre}_kc_refresh_token`,
    returnTo: `${pre}_kc_return_to`,
    state: `${pre}_kc_oauth_state`
  };
}

export type TokenResponse = {
  access_token: string;
  expires_in: number;
  id_token?: string;
  refresh_token?: string;
  token_type: string;
};

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

/** RFC 7636 PKCE pair (S256). */
export function generatePkcePair(): { challenge: string; verifier: string } {
  const verifier = base64UrlEncode(randomBytes(32));
  const challenge = base64UrlEncode(createHash("sha256").update(verifier, "utf8").digest());
  return { challenge, verifier };
}

export function keycloakAuthorizationEndpoint(issuerTrimmed: string): string {
  return `${issuerTrimmed}/protocol/openid-connect/auth`;
}

export function keycloakTokenEndpoint(issuerTrimmed: string): string {
  return `${issuerTrimmed}/protocol/openid-connect/token`;
}

/**
 * When enabled via `KEYCLOAK_NODE_USE_IPV4_LOOPBACK`, rewrite `localhost` → `127.0.0.1` for
 * server-side token/revocation fetches only (Node may prefer IPv6 loopback while Keycloak listens on IPv4).
 * Off by default so issuer URLs behave exactly as configured (matches typical local Keycloak setups).
 */
function issuerHostForNodeHttp(issuerTrimmed: string): string {
  const raw = process.env.KEYCLOAK_NODE_USE_IPV4_LOOPBACK?.trim().toLowerCase();
  const enabled = raw === "1" || raw === "true" || raw === "yes";
  if (!enabled) {
    return issuerTrimmed;
  }
  return issuerTrimmed.replace(/^(https?:\/\/)localhost(?=[:/]|$)/iu, "$1127.0.0.1");
}

export function keycloakLogoutEndpoint(issuerTrimmed: string): string {
  return `${issuerTrimmed}/protocol/openid-connect/logout`;
}

export function buildAuthorizationRedirect(params: {
  clientId: string;
  codeChallenge: string;
  issuer: string;
  redirectUri: string;
  scope?: string;
  state: string;
  /** Extra query parameters for the authorization request (e.g. identity provider hint). */
  extraSearchParams?: Record<string, string | undefined>;
}): string {
  const issuer = params.issuer.replace(/\/$/u, "");
  const u = new URL(keycloakAuthorizationEndpoint(issuer));
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", params.scope ?? "openid email profile");
  u.searchParams.set("state", params.state);
  u.searchParams.set("code_challenge", params.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  if (params.extraSearchParams) {
    for (const [k, v] of Object.entries(params.extraSearchParams)) {
      if (v !== undefined && v !== "") {
        u.searchParams.set(k, v);
      }
    }
  }
  return u.toString();
}

export async function exchangeAuthorizationCode(params: {
  clientId: string;
  clientSecret?: string;
  code: string;
  codeVerifier: string;
  issuer: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  const issuer = params.issuer.replace(/\/$/u, "");
  const body = new URLSearchParams({
    client_id: params.clientId,
    code: params.code,
    code_verifier: params.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: params.redirectUri
  });
  if (params.clientSecret) {
    body.set("client_secret", params.clientSecret);
  }
  const res = await fetch(keycloakTokenEndpoint(issuerHostForNodeHttp(issuer)), {
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST"
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Keycloak token exchange failed: ${res.status} ${text.slice(0, 400)}`);
  }
  return (await res.json()) as TokenResponse;
}

export type ResourceOwnerPasswordGrantResult =
  | {
      errorDescription?: string;
      httpStatus: number;
      keycloakError?: string;
      ok: false;
    }
  | { ok: true; tokens: TokenResponse };

export type PasswordCredentials = { password: string; username: string };

export type PasswordLoginErrorCode =
  | "auth_method_not_allowed"
  | "bad_request"
  | "client_misconfigured"
  | "invalid_credentials"
  | "invalid_scope"
  | "login_failed"
  | "validation";

export type PasswordGrantFailure = Extract<ResourceOwnerPasswordGrantResult, { ok: false }>;

export function readPasswordCredentials(body: unknown): PasswordCredentials | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const o = body as Record<string, unknown>;
  const username = typeof o.username === "string" ? o.username.trim() : "";
  const password = typeof o.password === "string" ? o.password : "";
  if (!username || !password || username.length > 256 || password.length > 4096) {
    return null;
  }
  return { password, username };
}

export function classifyPasswordGrantFailure(grant: PasswordGrantFailure): {
  code: PasswordLoginErrorCode;
  status: number;
} {
  const kc = grant.keycloakError;
  if (kc === "invalid_client") {
    return { code: "client_misconfigured", status: 502 };
  }
  if (kc === "unauthorized_client" || kc === "unsupported_grant_type") {
    const desc = (grant.errorDescription ?? "").toLowerCase();
    const looksLikeClientAuth =
      desc.includes("invalid client") ||
      desc.includes("client credentials") ||
      desc.includes("client authentication");
    if (kc === "unauthorized_client" && looksLikeClientAuth) {
      return { code: "client_misconfigured", status: 502 };
    }
    return { code: "auth_method_not_allowed", status: 403 };
  }
  if (kc === "invalid_scope") {
    return { code: "invalid_scope", status: 400 };
  }
  if (kc === "invalid_grant") {
    return { code: "invalid_credentials", status: 401 };
  }
  if (kc === "invalid_token_response") {
    return { code: "login_failed", status: 502 };
  }
  const status = grant.httpStatus >= 400 && grant.httpStatus < 600 ? grant.httpStatus : 502;
  return { code: "login_failed", status };
}

export function keycloakDebugPayloadForDev(
  grant: PasswordGrantFailure,
  issuer: string,
  nodeEnv = process.env.NODE_ENV
): { debug?: Record<string, unknown> } {
  if (nodeEnv !== "development") {
    return {};
  }
  return {
    debug: {
      errorDescription:
        typeof grant.errorDescription === "string"
          ? grant.errorDescription.slice(0, 400)
          : undefined,
      httpStatus: grant.httpStatus,
      issuer,
      keycloakError: grant.keycloakError
    }
  };
}

export function safeReturnToPath(raw: string | null | undefined, fallback: string): string {
  if (!raw || raw.length > 2048 || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  return raw;
}

export function isAccessTokenUsable(token: string, minTtlMs = 30_000): boolean {
  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return false;
    }
    const normalized = payload.replace(/-/gu, "+").replace(/_/gu, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as { exp?: unknown };
    return typeof decoded.exp === "number" && decoded.exp * 1000 > Date.now() + minTtlMs;
  } catch {
    return false;
  }
}

/** Resource Owner Password Credentials grant (direct access). Requires `directAccessGrantsEnabled` on the client. */
export async function tryResourceOwnerPasswordGrant(params: {
  clientId: string;
  clientSecret?: string;
  issuer: string;
  password: string;
  scope?: string;
  username: string;
}): Promise<ResourceOwnerPasswordGrantResult> {
  const issuer = params.issuer.replace(/\/$/u, "");
  const body = new URLSearchParams({
    client_id: params.clientId,
    grant_type: "password",
    password: params.password,
    scope: params.scope ?? "openid email profile",
    username: params.username
  });
  if (params.clientSecret) {
    body.set("client_secret", params.clientSecret);
  }
  const res = await fetch(keycloakTokenEndpoint(issuerHostForNodeHttp(issuer)), {
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST"
  });
  const text = await res.text();
  if (!res.ok) {
    let keycloakError: string | undefined;
    let errorDescription: string | undefined;
    try {
      const j = JSON.parse(text) as { error?: string; error_description?: string };
      keycloakError = typeof j.error === "string" ? j.error : undefined;
      errorDescription = typeof j.error_description === "string" ? j.error_description : undefined;
    } catch {
      /* not JSON */
    }
    return { errorDescription, httpStatus: res.status, keycloakError, ok: false };
  }
  try {
    const tokens = JSON.parse(text) as TokenResponse;
    if (typeof tokens.access_token !== "string") {
      return { httpStatus: 502, keycloakError: "invalid_token_response", ok: false };
    }
    return { ok: true, tokens };
  } catch {
    return { httpStatus: 502, keycloakError: "invalid_token_response", ok: false };
  }
}

export async function exchangeResourceOwnerPassword(params: {
  clientId: string;
  clientSecret?: string;
  issuer: string;
  password: string;
  scope?: string;
  username: string;
}): Promise<TokenResponse> {
  const r = await tryResourceOwnerPasswordGrant(params);
  if (!r.ok) {
    throw new Error(
      `Keycloak password grant failed: ${r.httpStatus} ${r.keycloakError ?? ""} ${r.errorDescription ?? ""}`.trim()
    );
  }
  return r.tokens;
}

export async function refreshAccessToken(params: {
  clientId: string;
  clientSecret?: string;
  issuer: string;
  refreshToken: string;
}): Promise<TokenResponse> {
  const issuer = params.issuer.replace(/\/$/u, "");
  const body = new URLSearchParams({
    client_id: params.clientId,
    grant_type: "refresh_token",
    refresh_token: params.refreshToken
  });
  if (params.clientSecret) {
    body.set("client_secret", params.clientSecret);
  }
  const res = await fetch(keycloakTokenEndpoint(issuerHostForNodeHttp(issuer)), {
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST"
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Keycloak refresh failed: ${res.status} ${text.slice(0, 400)}`);
  }
  return (await res.json()) as TokenResponse;
}

export function buildLogoutRedirect(params: {
  idTokenHint?: string;
  issuer: string;
  postLogoutRedirectUri: string;
}): string {
  const issuer = params.issuer.replace(/\/$/u, "");
  const u = new URL(keycloakLogoutEndpoint(issuer));
  u.searchParams.set("post_logout_redirect_uri", params.postLogoutRedirectUri);
  if (params.idTokenHint) {
    u.searchParams.set("id_token_hint", params.idTokenHint);
  }
  return u.toString();
}

export function keycloakRevocationEndpoint(issuerTrimmed: string): string {
  return `${issuerTrimmed}/protocol/openid-connect/revoke`;
}

/**
 * Server-side (backchannel) session revocation.
 * Revokes the refresh token and effectively ends the Keycloak session
 * without any browser redirect to Keycloak UI.
 */
export async function revokeKeycloakSession(params: {
  clientId: string;
  clientSecret?: string;
  issuer: string;
  refreshToken: string;
}): Promise<boolean> {
  const issuer = params.issuer.replace(/\/$/u, "");
  const body = new URLSearchParams({
    client_id: params.clientId,
    token: params.refreshToken,
    token_type_hint: "refresh_token"
  });
  if (params.clientSecret) {
    body.set("client_secret", params.clientSecret);
  }
  const res = await fetch(keycloakRevocationEndpoint(issuerHostForNodeHttp(issuer)), {
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST"
  });
  return res.ok;
}
