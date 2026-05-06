import {
  classifyPasswordGrantFailure,
  keycloakDebugPayloadForDev,
  readPasswordCredentials,
  tryResourceOwnerPasswordGrant
} from "@nihongo-bjt/keycloak-oidc";
import { NextResponse } from "next/server";

import { setTokenCookies } from "@/lib/kc-cookies";
import { getKcWebConfig } from "@/lib/kc-server-config";

export async function POST(request: Request) {
  const cfg = getKcWebConfig();
  if (!cfg?.clientSecret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const creds = readPasswordCredentials(parsed);
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
      if (process.env.NODE_ENV === "development") {
        console.warn("[password-login] Keycloak grant failed", {
          clientId: cfg.clientId,
          error: grant.keycloakError,
          errorDescription: grant.errorDescription,
          httpStatus: grant.httpStatus
        });
      }
      const classified = classifyPasswordGrantFailure(grant);
      return NextResponse.json(
        { error: classified.code, ...keycloakDebugPayloadForDev(grant, cfg.issuer) },
        { status: classified.status }
      );
    }
    const res = NextResponse.json({ ok: true });
    setTokenCookies(res, grant.tokens);
    return res;
  } catch {
    return NextResponse.json({ error: "login_failed" }, { status: 502 });
  }
}
