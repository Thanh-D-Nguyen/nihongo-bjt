import {
  classifyPasswordGrantFailure,
  keycloakDebugPayloadForDev,
  readPasswordCredentials,
  tryResourceOwnerPasswordGrant
} from "@nihongo-bjt/keycloak-oidc";
import { NextResponse } from "next/server";

import { safeReturnToPath, setTokenCookies } from "@/lib/kc-cookies";
import { getKcAdminConfig } from "@/lib/kc-server-config";

export async function POST(request: Request) {
  const cfg = getKcAdminConfig();
  const contentType = request.headers.get("content-type") ?? "";
  const isForm =
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data");

  // Form-encoded fallback (works when JS hasn't hydrated yet, e.g. headless QA + a11y/no-JS).
  if (isForm) {
    if (!cfg?.clientSecret) {
      const url = new URL(request.url);
      return NextResponse.redirect(
        new URL(
          `/${url.searchParams.get("locale") ?? "vi"}/login?authError=not_configured`,
          request.url
        ),
        { status: 303 }
      );
    }
    const form = await request.formData();
    const username =
      typeof form.get("username") === "string" ? String(form.get("username")).trim() : "";
    const password = typeof form.get("password") === "string" ? String(form.get("password")) : "";
    const returnToRaw = form.get("returnTo");
    const localeRaw = form.get("locale");
    const locale =
      typeof localeRaw === "string" && /^[a-z]{2,5}$/u.test(localeRaw) ? localeRaw : "vi";
    const returnTo = safeReturnToPath(
      typeof returnToRaw === "string" ? returnToRaw : null,
      `/${locale}`
    );
    // Preserve the typed username across the no-JS form-fallback round trip so
    // operators do not have to re-type it after a wrong-password redirect. We
    // only echo it back via `?u=` on error responses (never on success), and we
    // cap the length so a hostile actor cannot stuff arbitrary data into the
    // login URL through this parameter.
    const safeUsername = username.length > 0 && username.length <= 256 ? username : "";
    const errorQs = (code: string) => {
      const qs = new URLSearchParams({ authError: code });
      if (safeUsername) {
        qs.set("u", safeUsername);
      }
      return qs.toString();
    };
    if (!username || !password || username.length > 256 || password.length > 4096) {
      return NextResponse.redirect(
        new URL(`/${locale}/login?${errorQs("validation")}`, request.url),
        { status: 303 }
      );
    }
    try {
      const grant = await tryResourceOwnerPasswordGrant({
        clientId: cfg.clientId,
        clientSecret: cfg.clientSecret,
        issuer: cfg.issuer,
        password,
        username
      });
      if (!grant.ok) {
        const errParam = classifyPasswordGrantFailure(grant).code;
        return NextResponse.redirect(
          new URL(`/${locale}/login?${errorQs(errParam)}`, request.url),
          { status: 303 }
        );
      }
      const res = NextResponse.redirect(new URL(returnTo, request.url), { status: 303 });
      setTokenCookies(res, grant.tokens);
      return res;
    } catch {
      return NextResponse.redirect(
        new URL(`/${locale}/login?${errorQs("login_failed")}`, request.url),
        { status: 303 }
      );
    }
  }

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
