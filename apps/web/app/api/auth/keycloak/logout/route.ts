import { revokeKeycloakSession } from "@nihongo-bjt/keycloak-oidc";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clearKcCookies, learnerKcCookies } from "@/lib/kc-cookies";
import { getKcWebConfig } from "@/lib/kc-server-config";

/** POST — Backchannel logout (CSRF-safe: SameSite=Lax cookies not sent on cross-origin POST). */
export async function POST(request: Request) {
  const cfg = getKcWebConfig();
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") === "ja" ? "ja" : "vi";
  const jar = await cookies();

  const publicBase = cfg?.publicBaseUrl
    ?? (process.env.WEB_PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/u, "");

  // Backchannel: revoke the refresh token server-side (no Keycloak redirect)
  if (cfg) {
    const refreshToken = jar.get(learnerKcCookies.refresh)?.value;
    if (refreshToken) {
      try {
        await revokeKeycloakSession({
          clientId: cfg.clientId,
          clientSecret: cfg.clientSecret,
          issuer: cfg.issuer,
          refreshToken,
        });
      } catch {
        // Best-effort: if revocation fails, still clear local cookies
      }
    }
  }

  const res = NextResponse.json({ ok: true, redirectTo: `/${locale}/login` });
  clearKcCookies(res);
  return res;
}

/** GET — Fallback for direct navigation / anchor links. */
export async function GET(request: Request) {
  const cfg = getKcWebConfig();
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") === "ja" ? "ja" : "vi";
  const jar = await cookies();

  const publicBase = cfg?.publicBaseUrl
    ?? (process.env.WEB_PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/u, "");

  if (cfg) {
    const refreshToken = jar.get(learnerKcCookies.refresh)?.value;
    if (refreshToken) {
      try {
        await revokeKeycloakSession({
          clientId: cfg.clientId,
          clientSecret: cfg.clientSecret,
          issuer: cfg.issuer,
          refreshToken,
        });
      } catch {
        // Best-effort
      }
    }
  }

  const res = NextResponse.redirect(new URL(`/${locale}/login`, publicBase));
  clearKcCookies(res);
  return res;
}
