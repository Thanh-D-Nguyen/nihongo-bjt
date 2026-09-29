import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getServerApiBaseUrl } from "@/lib/server-api-url";

export const dynamic = "force-dynamic";

/**
 * BFF: GET /api/auth/me — proxies to Go API GET /api/auth/me.
 * Forwards the bjt_web_session cookie from the browser request to the Go API
 * so the Go session middleware can authenticate the learner.
 */
export async function GET() {
  const apiBase = getServerApiBaseUrl();
  const jar = await cookies();
  const sessionCookie = jar.get("bjt_web_session");

  if (!sessionCookie?.value) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBase}/api/auth/me`, {
      cache: "no-store",
      headers: {
        Cookie: `bjt_web_session=${sessionCookie.value}`
      }
    });
  } catch {
    return NextResponse.json(
      {
        error: "api_unreachable",
        attemptedUrl: `${apiBase}/api/auth/me`
      },
      { status: 503 }
    );
  }

  const body = await upstream.text();
  const contentType =
    upstream.headers.get("content-type") ?? "application/json; charset=utf-8";
  return new NextResponse(body, {
    status: upstream.status,
    headers: { "content-type": contentType }
  });
}