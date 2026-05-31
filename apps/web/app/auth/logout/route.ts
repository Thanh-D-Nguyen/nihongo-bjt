import { isSupportedLocale } from "@nihongo-bjt/config";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const localeParam = url.searchParams.get("locale") ?? "";
  const locale = isSupportedLocale(localeParam) ? localeParam : "vi";
  const publicBase = (process.env.WEB_PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/u, "");
  return NextResponse.redirect(
    new URL(`/api/auth/keycloak/logout?locale=${encodeURIComponent(locale)}`, publicBase)
  );
}
