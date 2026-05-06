import { NextResponse } from "next/server";

import { resolveLearnerAccessForServer } from "@/lib/learner-access-resolve";

export const dynamic = "force-dynamic";

export async function GET() {
  const resolved = await resolveLearnerAccessForServer();
  if (resolved.kind === "no_config") {
    return NextResponse.json({ error: "keycloak_not_configured" }, { status: 503 });
  }
  if (resolved.kind === "unauthorized") {
    return NextResponse.json({ error: resolved.reason }, { status: 401 });
  }
  const res = NextResponse.json({ accessToken: resolved.access });
  resolved.applyRefreshedCookies?.(res);
  return res;
}
