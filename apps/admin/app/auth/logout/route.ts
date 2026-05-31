import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") === "ja" ? "ja" : "vi";
  const publicBase = (process.env.ADMIN_PUBLIC_URL ?? "http://localhost:3001").replace(/\/$/u, "");
  return NextResponse.redirect(
    new URL(`/api/auth/keycloak/logout?locale=${encodeURIComponent(locale)}`, publicBase)
  );
}
