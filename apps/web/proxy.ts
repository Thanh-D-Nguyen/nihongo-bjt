import { NextResponse, type NextRequest } from "next/server";

import { negotiateLocale } from "./lib/locale-negotiation";

/**
 * Sends the bare site root (e.g. kiokoto.com) to the locale that matches the browser's language.
 * The response varies by Accept-Language, so caches must key on that header.
 */
export function proxy(request: NextRequest) {
  const locale = negotiateLocale(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}`;

  const response = NextResponse.redirect(url, 307);
  response.headers.append("Vary", "Accept-Language");
  return response;
}

export const config = {
  matcher: "/"
};
