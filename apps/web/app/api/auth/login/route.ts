import { NextRequest, NextResponse } from "next/server";
import { getServerApiBaseUrl } from "../../../../lib/server-api-url";

/**
 * POST /api/auth/login — proxies to Go API POST /api/auth/login.
 * The Go API sets the bjt_web_session cookie directly on the response;
 * we forward it to the browser so cookie-based auth works seamlessly.
 */
export async function POST(req: NextRequest) {
  const baseUrl = getServerApiBaseUrl();
  const body = await req.text();

  try {
    const upstream = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: req.headers.get("origin") ?? "http://localhost:3000"
      },
      body
    });

    const responseBody = await upstream.text();
    const res = new NextResponse(responseBody, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" }
    });

    // Forward Set-Cookie headers from Go API to the browser.
    const setCookies = upstream.headers.getSetCookie?.() ?? [];
    for (const cookie of setCookies) {
      res.headers.append("Set-Cookie", cookie);
    }

    return res;
  } catch (err) {
    console.error("[login BFF] upstream error:", err);
    return NextResponse.json(
      { error: "Login service unavailable" },
      { status: 502 }
    );
  }
}