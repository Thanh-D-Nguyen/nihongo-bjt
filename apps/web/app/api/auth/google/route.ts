import { NextRequest, NextResponse } from "next/server";
import { getServerApiBaseUrl } from "../../../../lib/server-api-url";

export async function POST(req: NextRequest) {
  // Browser login is same-origin. Native SDKs call the Go endpoint directly.
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!req.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const body = await req.text();
  if (body.length > 4096) return NextResponse.json({ error: "request too large" }, { status: 413 });

  try {
    const forwardedFor = req.headers.get("x-forwarded-for");
    const upstream = await fetch(`${getServerApiBaseUrl()}/api/auth/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {})
      },
      body,
      cache: "no-store"
    });
    const response = NextResponse.json(upstream.ok ? { ok: true } : { error: "google_login_failed" }, { status: upstream.status });
    for (const cookie of upstream.headers.getSetCookie?.() ?? []) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 502 });
  }
}
