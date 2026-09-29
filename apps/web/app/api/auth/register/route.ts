import { NextRequest, NextResponse } from "next/server";
import { getServerApiBaseUrl } from "../../../../lib/server-api-url";

/**
 * POST /api/auth/register — proxies to Go API POST /api/auth/register.
 * Forwards Set-Cookie headers (session cookie set on successful registration).
 */
export async function POST(req: NextRequest) {
  const baseUrl = getServerApiBaseUrl();
  const body = await req.text();

  try {
    const upstream = await fetch(`${baseUrl}/api/auth/register`, {
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
    console.error("[register BFF] upstream error:", err);
    return NextResponse.json(
      { error: "Registration service unavailable" },
      { status: 502 }
    );
  }
}