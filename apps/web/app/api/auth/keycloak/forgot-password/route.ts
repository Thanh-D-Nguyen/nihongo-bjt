import { NextResponse } from "next/server";

import {
  fetchMasterAdminAccessToken,
  findRealmUserByEmail,
  sendResetPasswordEmail
} from "@/lib/kc-keycloak-admin";
import { getKcAdminBootstrap, getKcWebConfig } from "@/lib/kc-server-config";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export async function POST(request: Request) {
  const cfg = getKcWebConfig();
  if (!cfg?.clientSecret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const admin = getKcAdminBootstrap();
  if (!admin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const email = typeof (parsed as Record<string, unknown>).email === "string"
    ? ((parsed as Record<string, unknown>).email as string).trim().toLowerCase()
    : "";
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  try {
    const adminToken = await fetchMasterAdminAccessToken({
      baseUrl: admin.baseUrl,
      password: admin.password,
      username: admin.username
    });

    const user = await findRealmUserByEmail({
      adminToken,
      baseUrl: admin.baseUrl,
      email,
      realm: admin.realm
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    await sendResetPasswordEmail({
      adminToken,
      baseUrl: admin.baseUrl,
      realm: admin.realm,
      userId: user.id
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
