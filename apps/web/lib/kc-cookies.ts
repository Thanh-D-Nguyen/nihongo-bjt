import { KC_COOKIE, type TokenResponse } from "@nihongo-bjt/keycloak-oidc";
import type { NextResponse } from "next/server";

export function kcBaseCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    maxAge: maxAgeSec,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}

export function setTokenCookies(res: NextResponse, tokens: TokenResponse) {
  const accessAge = Math.max(60, Math.min(tokens.expires_in ?? 300, 3600));
  res.cookies.set(KC_COOKIE.access, tokens.access_token, kcBaseCookieOptions(accessAge));
  if (tokens.refresh_token) {
    res.cookies.set(KC_COOKIE.refresh, tokens.refresh_token, kcBaseCookieOptions(60 * 60 * 24 * 30));
  }
  if (tokens.id_token) {
    res.cookies.set(KC_COOKIE.idToken, tokens.id_token, kcBaseCookieOptions(accessAge));
  }
}

export function clearKcCookies(res: NextResponse) {
  const cleared = { ...kcBaseCookieOptions(0), maxAge: 0 };
  for (const name of Object.values(KC_COOKIE)) {
    res.cookies.set(name, "", cleared);
  }
}

export function safeReturnToPath(raw: string | null, fallback: string): string {
  if (!raw || raw.length > 2048 || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  return raw;
}

export function ephemeralOauthCookieOptions() {
  return { ...kcBaseCookieOptions(600) };
}
