import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") === "ja" ? "ja" : "vi";
  return NextResponse.redirect(
    new URL(`/api/auth/keycloak/logout?locale=${encodeURIComponent(locale)}`, url.origin)
  );
}
