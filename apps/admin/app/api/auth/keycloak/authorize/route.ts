import { buildAuthorizationRedirect, generatePkcePair } from "@nihongo-bjt/keycloak-oidc";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { adminKcCookies, ephemeralOauthCookieOptions, safeReturnToPath } from "@/lib/kc-cookies";
import { getKcAdminConfig } from "@/lib/kc-server-config";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cfg = getKcAdminConfig();
  if (!cfg) {
    const localePrefix = url.searchParams.get("locale")?.trim();
    const locale = localePrefix === "ja" ? "ja" : "vi";
    const publicBase = (process.env.ADMIN_PUBLIC_URL ?? "http://localhost:3001").replace(/\/$/u, "");
    return NextResponse.redirect(new URL(`/${locale}/login?authError=not_configured`, publicBase));
  }

  const localePrefix = url.searchParams.get("locale")?.trim();
  const defaultHome =
    localePrefix === "ja" || localePrefix === "vi" ? `/${localePrefix}` : "/vi";
  const returnTo = safeReturnToPath(url.searchParams.get("returnTo"), defaultHome);

  const idpKey = url.searchParams.get("idp")?.trim();
  const googleHint = process.env.NEXT_PUBLIC_AUTH_GOOGLE_IDP_HINT?.trim();
  const appleHint = process.env.NEXT_PUBLIC_AUTH_APPLE_IDP_HINT?.trim();
  const extraSearchParams: Record<string, string | undefined> = {};
  if (idpKey === "google" && googleHint) {
    extraSearchParams.kc_idp_hint = googleHint;
  } else if (idpKey === "apple" && appleHint) {
    extraSearchParams.kc_idp_hint = appleHint;
  }

  const { challenge, verifier } = generatePkcePair();
  const state = randomBytes(24).toString("hex");
  const jar = await cookies();
  const opt = ephemeralOauthCookieOptions();
  jar.set(adminKcCookies.pkceVerifier, verifier, opt);
  jar.set(adminKcCookies.state, state, opt);
  jar.set(adminKcCookies.returnTo, returnTo, opt);

  const location = buildAuthorizationRedirect({
    clientId: cfg.clientId,
    codeChallenge: challenge,
    issuer: cfg.issuer,
    redirectUri: cfg.redirectUri,
    extraSearchParams,
    state
  });

  return NextResponse.redirect(location);
}
