import { isAccessTokenUsable, refreshAccessToken } from "@nihongo-bjt/keycloak-oidc";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { learnerKcCookies, setTokenCookies } from "@/lib/kc-cookies";
import { getKcWebConfig } from "@/lib/kc-server-config";

export type ResolveLearnerAccessResult =
  | { kind: "no_config" }
  | { kind: "unauthorized"; reason: "no_session" | "refresh_failed" }
  | { kind: "ok"; access: string; applyRefreshedCookies?: (res: NextResponse) => void };

/**
 * Server-only: read HttpOnly learner cookies and optionally refresh.
 * Used by `/api/auth/keycloak/session` and `/api/auth/me` BFF.
 */
export async function resolveLearnerAccessForServer(): Promise<ResolveLearnerAccessResult> {
  const cfg = getKcWebConfig();
  if (!cfg) {
    return { kind: "no_config" };
  }

  const jar = await cookies();
  const access = jar.get(learnerKcCookies.access)?.value;
  if (access && isAccessTokenUsable(access, -15_000)) {
    return { kind: "ok", access };
  }

  const refresh = jar.get(learnerKcCookies.refresh)?.value;
  if (!refresh) {
    return { kind: "unauthorized", reason: "no_session" };
  }

  try {
    const tokens = await refreshAccessToken({
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      issuer: cfg.issuer,
      refreshToken: refresh
    });
    return {
      kind: "ok",
      access: tokens.access_token,
      applyRefreshedCookies: (res) => setTokenCookies(res, tokens)
    };
  } catch {
    return { kind: "unauthorized", reason: "refresh_failed" };
  }
}
