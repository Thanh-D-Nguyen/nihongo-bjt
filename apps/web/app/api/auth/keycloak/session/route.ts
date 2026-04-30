import { KC_COOKIE, refreshAccessToken } from "@nihongo-bjt/keycloak-oidc";
import { decodeJwt } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { setTokenCookies } from "@/lib/kc-cookies";
import { getKcWebConfig } from "@/lib/kc-server-config";

export const dynamic = "force-dynamic";

/** Accept access JWT until shortly after exp (clock skew), not "must have 30+ seconds left" (that falsely sent users to refresh / 401). */
function accessStillValid(token: string): boolean {
  try {
    const { exp } = decodeJwt(token);
    if (typeof exp !== "number") {
      return token.split(".").length === 3;
    }
    return exp * 1000 > Date.now() - 15_000;
  } catch {
    return false;
  }
}

export async function GET() {
  const cfg = getKcWebConfig();
  if (!cfg) {
    return NextResponse.json({ error: "keycloak_not_configured" }, { status: 503 });
  }

  const jar = await cookies();
  const access = jar.get(KC_COOKIE.access)?.value;
  if (access && accessStillValid(access)) {
    return NextResponse.json({ accessToken: access });
  }

  const refresh = jar.get(KC_COOKIE.refresh)?.value;
  if (!refresh) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }

  try {
    const tokens = await refreshAccessToken({
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      issuer: cfg.issuer,
      refreshToken: refresh
    });
    const res = NextResponse.json({ accessToken: tokens.access_token });
    setTokenCookies(res, tokens);
    return res;
  } catch {
    return NextResponse.json({ error: "refresh_failed" }, { status: 401 });
  }
}
