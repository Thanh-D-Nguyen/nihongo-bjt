import { buildLogoutRedirect, KC_COOKIE } from "@nihongo-bjt/keycloak-oidc";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clearKcCookies } from "@/lib/kc-cookies";
import { getKcAdminConfig } from "@/lib/kc-server-config";

export async function GET(request: Request) {
  const cfg = getKcAdminConfig();
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") === "ja" ? "ja" : "vi";
  const jar = await cookies();
  const idHint = jar.get(KC_COOKIE.idToken)?.value;

  if (!cfg) {
    const base = (process.env.ADMIN_PUBLIC_URL ?? "http://localhost:3001").replace(/\/$/u, "");
    const res = NextResponse.redirect(new URL(`/${locale}/login`, base));
    clearKcCookies(res);
    return res;
  }

  const postLogout = new URL(`/${locale}/login`, cfg.publicBaseUrl).toString();
  const logoutUrl = buildLogoutRedirect({
    idTokenHint: idHint,
    issuer: cfg.issuer,
    postLogoutRedirectUri: postLogout
  });

  const res = NextResponse.redirect(logoutUrl);
  clearKcCookies(res);
  return res;
}
