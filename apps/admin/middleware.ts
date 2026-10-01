import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SUPPORTED_LOCALES = ["en", "ja", "vi"] as const;
const DEFAULT_LOCALE = "en";

/**
 * Admin middleware — preserves /admin prefix during locale redirects.
 *
 * Without basePath in next.config, Next.js doesn't know it's served under
 * /admin/*. This middleware ensures locale detection redirects stay within
 * the /admin namespace (e.g., /admin/en/login not /en/login).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only handle /admin/* paths
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // Extract path after /admin
  const afterAdmin = pathname.slice("/admin".length) || "/";

  // Check if path already has a supported locale
  const segments = afterAdmin.split("/").filter(Boolean);
  const firstSegment = segments[0];
  const hasLocale = SUPPORTED_LOCALES.includes(firstSegment as typeof SUPPORTED_LOCALES[number]);

  if (hasLocale) {
    // Already localized — let Next.js handle it
    return NextResponse.next();
  }

  // No locale detected — redirect to default locale under /admin
  // e.g., /admin/login → /admin/en/login
  const newUrl = request.nextUrl.clone();
  newUrl.pathname = `/admin/${DEFAULT_LOCALE}${afterAdmin === "/" ? "" : afterAdmin}`;
  return NextResponse.redirect(newUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};