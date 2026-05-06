import { revokeKeycloakSession } from "@nihongo-bjt/keycloak-oidc";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { adminKcCookies, clearKcCookies } from "@/lib/kc-cookies";
import { getKcAdminConfig } from "@/lib/kc-server-config";

/** POST — Backchannel logout (CSRF-safe). */
export async function POST(request: Request) {
  const cfg = getKcAdminConfig();
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") === "ja" ? "ja" : "vi";
  const jar = await cookies();

  const publicBase = cfg?.publicBaseUrl
    ?? (process.env.ADMIN_PUBLIC_URL ?? "http://localhost:3001").replace(/\/$/u, "");

  if (cfg) {
    const refreshToken = jar.get(adminKcCookies.refresh)?.value;
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

  const res = NextResponse.json({ ok: true, redirectTo: `/${locale}/login` });
  clearKcCookies(res);
  return res;
}

/** GET — Fallback for direct navigation. */
export async function GET(request: Request) {
  const cfg = getKcAdminConfig();
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") === "ja" ? "ja" : "vi";
  const jar = await cookies();

  const publicBase = cfg?.publicBaseUrl
    ?? (process.env.ADMIN_PUBLIC_URL ?? "http://localhost:3001").replace(/\/$/u, "");

  if (cfg) {
    const refreshToken = jar.get(adminKcCookies.refresh)?.value;
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
