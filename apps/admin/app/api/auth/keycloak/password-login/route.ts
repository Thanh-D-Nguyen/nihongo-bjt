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

function isSafeReturnTo(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}

export async function POST(request: Request) {
  const cfg = getKcAdminConfig();
  const contentType = request.headers.get("content-type") ?? "";
  const isForm =
    contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

  // Form-encoded fallback (works when JS hasn't hydrated yet, e.g. headless QA + a11y/no-JS).
  if (isForm) {
    if (!cfg?.clientSecret) {
      const url = new URL(request.url);
      return NextResponse.redirect(
        new URL(`/${url.searchParams.get("locale") ?? "vi"}/login?authError=not_configured`, request.url),
        { status: 303 }
      );
    }
    const form = await request.formData();
    const username = typeof form.get("username") === "string" ? String(form.get("username")).trim() : "";
    const password = typeof form.get("password") === "string" ? String(form.get("password")) : "";
    const returnToRaw = form.get("returnTo");
    const localeRaw = form.get("locale");
    const locale = typeof localeRaw === "string" && /^[a-z]{2,5}$/u.test(localeRaw) ? localeRaw : "vi";
    const returnTo = isSafeReturnTo(typeof returnToRaw === "string" ? returnToRaw : null)
      ? (returnToRaw as string)
      : `/${locale}`;
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
        const errParam = grant.keycloakError === "invalid_grant" ? "invalid_credentials" : "login_failed";
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
