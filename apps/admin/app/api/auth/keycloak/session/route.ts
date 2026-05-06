import { isAccessTokenUsable, refreshAccessToken } from "@nihongo-bjt/keycloak-oidc";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { adminKcCookies, setTokenCookies } from "@/lib/kc-cookies";
import { getKcAdminConfig } from "@/lib/kc-server-config";

export async function GET() {
  const cfg = getKcAdminConfig();
  if (!cfg) {
    return NextResponse.json({ error: "keycloak_not_configured" }, { status: 503 });
  }

  const jar = await cookies();
  const access = jar.get(adminKcCookies.access)?.value;
  if (access && isAccessTokenUsable(access)) {
    return NextResponse.json({ accessToken: access });
  }

  const refresh = jar.get(adminKcCookies.refresh)?.value;
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
