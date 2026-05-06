import {
  buildKcCookieNames,
  KC_COOKIE as KC_COOKIE_LEGACY,
  safeReturnToPath,
  type TokenResponse
} from "@nihongo-bjt/keycloak-oidc";
import type { NextResponse } from "next/server";

export const adminKcCookies = buildKcCookieNames("admin");

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
  res.cookies.set(adminKcCookies.access, tokens.access_token, kcBaseCookieOptions(accessAge));
  if (tokens.refresh_token) {
    res.cookies.set(
      adminKcCookies.refresh,
      tokens.refresh_token,
      kcBaseCookieOptions(60 * 60 * 24 * 30)
    );
  }
  if (tokens.id_token) {
    res.cookies.set(adminKcCookies.idToken, tokens.id_token, kcBaseCookieOptions(accessAge));
  }
}

export function clearKcCookies(res: NextResponse) {
  const cleared = { ...kcBaseCookieOptions(0), maxAge: 0 };
  const names = new Set<string>([
    ...Object.values(adminKcCookies),
    ...Object.values(KC_COOKIE_LEGACY)
  ]);
  for (const name of names) {
    res.cookies.set(name, "", cleared);
  }
}

export function ephemeralOauthCookieOptions() {
  return { ...kcBaseCookieOptions(600) };
}

export { safeReturnToPath };
