import {
  buildAuthorizationRedirect,
  generatePkcePair,
  KC_COOKIE
} from "@nihongo-bjt/keycloak-oidc";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ephemeralOauthCookieOptions, safeReturnToPath } from "@/lib/kc-cookies";
import { getKcWebConfig } from "@/lib/kc-server-config";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cfg = getKcWebConfig();
  if (!cfg) {
    const localePrefix = url.searchParams.get("locale")?.trim();
    const locale = localePrefix === "ja" ? "ja" : "vi";
    const publicBase = (process.env.WEB_PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/u, "");
    return NextResponse.redirect(new URL(`/${locale}/login?authError=not_configured`, publicBase));
  }

  const localePrefix = url.searchParams.get("locale")?.trim();
  const defaultHome =
    localePrefix === "ja" || localePrefix === "vi" ? `/${localePrefix}` : "/vi";
  const returnTo = safeReturnToPath(url.searchParams.get("returnTo"), defaultHome);

  const intent = url.searchParams.get("intent")?.trim();
  const idpKey = url.searchParams.get("idp")?.trim();
  const googleHint = process.env.NEXT_PUBLIC_AUTH_GOOGLE_IDP_HINT?.trim();
  const appleHint = process.env.NEXT_PUBLIC_AUTH_APPLE_IDP_HINT?.trim();
  const extraSearchParams: Record<string, string | undefined> = {};
  if (intent === "register" && process.env.NEXT_PUBLIC_AUTH_REGISTRATION_ENABLED !== "false") {
    extraSearchParams.kc_action = "register";
  }
  if (idpKey === "google" && googleHint) {
    extraSearchParams.kc_idp_hint = googleHint;
  } else if (idpKey === "apple" && appleHint) {
    extraSearchParams.kc_idp_hint = appleHint;
  }

  const { challenge, verifier } = generatePkcePair();
  const state = randomBytes(24).toString("hex");
  const jar = await cookies();
  const opt = ephemeralOauthCookieOptions();
  jar.set(KC_COOKIE.pkceVerifier, verifier, opt);
  jar.set(KC_COOKIE.state, state, opt);
  jar.set(KC_COOKIE.returnTo, returnTo, opt);

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
