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

export type TokenResponse = {
  access_token: string;
  expires_in: number;
  id_token?: string;
  refresh_token?: string;
  token_type: string;
};

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
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
  const res = await fetch(keycloakTokenEndpoint(issuer), {
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
  const res = await fetch(keycloakTokenEndpoint(issuer), {
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
  const res = await fetch(keycloakTokenEndpoint(issuer), {
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
