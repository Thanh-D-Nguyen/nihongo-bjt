import { tryResourceOwnerPasswordGrant } from "@nihongo-bjt/keycloak-oidc";
import { NextResponse } from "next/server";

import { setTokenCookies } from "@/lib/kc-cookies";
import { getKcAdminConfig } from "@/lib/kc-server-config";

function readCredentials(body: unknown): { password: string; username: string } | null {
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

export async function POST(request: Request) {
  const cfg = getKcAdminConfig();
  if (!cfg?.clientSecret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const creds = readCredentials(parsed);
  if (!creds) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  try {
    const grant = await tryResourceOwnerPasswordGrant({
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      issuer: cfg.issuer,
      password: creds.password,
      username: creds.username
    });
    if (!grant.ok) {
      const kc = grant.keycloakError;
      if (kc === "invalid_client") {
        return NextResponse.json({ error: "client_misconfigured" }, { status: 502 });
      }
      if (kc === "unauthorized_client" || kc === "unsupported_grant_type") {
        return NextResponse.json({ error: "auth_method_not_allowed" }, { status: 403 });
      }
      if (kc === "invalid_scope") {
        return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
      }
      if (kc === "invalid_grant" || (grant.httpStatus === 401 && !kc)) {
        return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
      }
      if (kc === "invalid_token_response") {
        return NextResponse.json({ error: "login_failed" }, { status: 502 });
      }
      return NextResponse.json(
        { error: "login_failed" },
        { status: grant.httpStatus >= 400 && grant.httpStatus < 600 ? grant.httpStatus : 502 }
      );
    }

    const res = NextResponse.json({ ok: true });
    setTokenCookies(res, grant.tokens);
    return res;
  } catch {
    return NextResponse.json({ error: "login_failed" }, { status: 502 });
  }
}
