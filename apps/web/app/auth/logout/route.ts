import { isSupportedLocale } from "@nihongo-bjt/config";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const localeParam = url.searchParams.get("locale") ?? "";
  const locale = isSupportedLocale(localeParam) ? localeParam : "vi";
  return NextResponse.redirect(
    new URL(`/api/auth/keycloak/logout?locale=${encodeURIComponent(locale)}`, url.origin)
  );
}
