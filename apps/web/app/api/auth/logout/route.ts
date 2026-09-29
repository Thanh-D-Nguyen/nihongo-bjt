import { NextRequest, NextResponse } from "next/server";
import { getServerApiBaseUrl } from "../../../../lib/server-api-url";

/**
 * POST /api/auth/logout — proxies to Go API POST /api/auth/logout.
 * The Go API clears the bjt_web_session cookie; we forward the Set-Cookie
 * header so the browser removes the session.
 */
export async function POST(req: NextRequest) {
  const baseUrl = getServerApiBaseUrl();

  try {
    const upstream = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: {
        Origin: req.headers.get("origin") ?? "http://localhost:3000",
        Cookie: req.headers.get("cookie") ?? ""
      }
    });

    const responseBody = await upstream.text();
    const res = new NextResponse(responseBody, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" }
    });

    // Forward Set-Cookie headers (session clearing) from Go API to the browser.
    const setCookies = upstream.headers.getSetCookie?.() ?? [];
    for (const cookie of setCookies) {
      res.headers.append("Set-Cookie", cookie);
    }

    return res;
  } catch (err) {
    console.error("[logout BFF] upstream error:", err);
    return NextResponse.json(
      { error: "Logout service unavailable" },
      { status: 502 }
    );
  }
}