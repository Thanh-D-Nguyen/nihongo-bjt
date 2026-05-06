import { exchangeAuthorizationCode } from "@nihongo-bjt/keycloak-oidc";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { adminKcCookies, clearKcCookies, safeReturnToPath, setTokenCookies } from "@/lib/kc-cookies";

export type KcCallbackConfig = {
  defaultFailLocalePrefix: string;
  getIssuerClient: () => {
    clientId: string;
    clientSecret?: string;
    issuer: string;
    publicBaseUrl: string;
    redirectUri: string;
  } | null;
};

export async function handleKeycloakOAuthCallback(request: Request, cfg: KcCallbackConfig) {
  const kc = cfg.getIssuerClient();
  const jar = await cookies();
  const failRedirect = (reason: string) => {
    const base = (kc?.publicBaseUrl ?? process.env.ADMIN_PUBLIC_URL ?? "http://localhost:3001").replace(
      /\/$/u,
      ""
    );
    const res = NextResponse.redirect(
      new URL(
        `${cfg.defaultFailLocalePrefix}/login?authError=${encodeURIComponent(reason)}`,
        base
      )
    );
    clearKcCookies(res);
    return res;
  };

  if (!kc) {
    return failRedirect("not_configured");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const expectedState = jar.get(adminKcCookies.state)?.value;
  const verifier = jar.get(adminKcCookies.pkceVerifier)?.value;
  const returnTo = safeReturnToPath(jar.get(adminKcCookies.returnTo)?.value ?? null, "/vi");

  jar.delete(adminKcCookies.state);
  jar.delete(adminKcCookies.pkceVerifier);
  jar.delete(adminKcCookies.returnTo);

  if (oauthError) {
    const code = oauthError === "access_denied" ? "access_denied" : "auth_failed";
    return failRedirect(code);
  }
  if (!code || !verifier || !state || state !== expectedState) {
    return failRedirect("invalid_callback");
  }

  try {
    const tokens = await exchangeAuthorizationCode({
      clientId: kc.clientId,
      clientSecret: kc.clientSecret,
      code,
      codeVerifier: verifier,
      issuer: kc.issuer,
      redirectUri: kc.redirectUri
    });
    const dest = new URL(returnTo, kc.publicBaseUrl);
    const res = NextResponse.redirect(dest);
    setTokenCookies(res, tokens);
    return res;
  } catch {
    return failRedirect("token_exchange_failed");
  }
}
