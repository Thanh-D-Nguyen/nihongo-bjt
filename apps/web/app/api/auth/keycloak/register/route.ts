import { exchangeResourceOwnerPassword } from "@nihongo-bjt/keycloak-oidc";
import { NextResponse } from "next/server";

import {
  assignRealmRole,
  createRealmUser,
  fetchMasterAdminAccessToken
} from "@/lib/kc-keycloak-admin";
import { setTokenCookies } from "@/lib/kc-cookies";
import { getKcAdminBootstrap, getKcWebConfig } from "@/lib/kc-server-config";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function readRegisterBody(body: unknown): { email: string; password: string; username: string } | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const o = body as Record<string, unknown>;
  const username = typeof o.username === "string" ? o.username.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim().toLowerCase() : "";
  const password = typeof o.password === "string" ? o.password : "";
  if (
    username.length < 2 ||
    username.length > 64 ||
    email.length < 5 ||
    email.length > 254 ||
    password.length < 8 ||
    password.length > 4096 ||
    !EMAIL_RE.test(email)
  ) {
    return null;
  }
  return { email, password, username };
}

export async function POST(request: Request) {
  const cfg = getKcWebConfig();
  if (!cfg?.clientSecret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const admin = getKcAdminBootstrap();
  if (!admin) {
    return NextResponse.json({ error: "registration_unavailable" }, { status: 503 });
  }
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const fields = readRegisterBody(parsed);
  if (!fields) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  try {
    const adminToken = await fetchMasterAdminAccessToken({
      baseUrl: admin.baseUrl,
      password: admin.password,
      username: admin.username
    });
    const created = await createRealmUser({
      adminToken,
      baseUrl: admin.baseUrl,
      email: fields.email,
      password: fields.password,
      realm: admin.realm,
      username: fields.username
    });
    if ("conflict" in created) {
      return NextResponse.json({ error: "user_exists" }, { status: 409 });
    }
    await assignRealmRole({
      adminToken,
      baseUrl: admin.baseUrl,
      realm: admin.realm,
      roleName: "user",
      userId: created.userId
    });

    // Auto-login after registration
    try {
      const tokens = await exchangeResourceOwnerPassword({
        clientId: cfg.clientId,
        clientSecret: cfg.clientSecret,
        issuer: cfg.issuer,
        password: fields.password,
        username: fields.username
      });
      const res = NextResponse.json({ ok: true });
      setTokenCookies(res, tokens);
      return res;
    } catch (loginErr) {
      // User was created but auto-login failed — still a success, just redirect to login
      console.error("[register] auto-login failed after user creation:", loginErr);
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    console.error("[register] registration failed:", err);
    return NextResponse.json({ error: "registration_failed" }, { status: 500 });
  }
}
