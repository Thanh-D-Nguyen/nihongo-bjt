import { isSupportedLocale, type SupportedLocale } from "@nihongo-bjt/config";
import { KC_COOKIE } from "@nihongo-bjt/keycloak-oidc";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import ja from "../../messages/ja.json";
import vi from "../../messages/vi.json";
import { KeycloakAuthShell } from "./_components/keycloak-auth-shell";
import { PwaRegister } from "../_components/pwa-register";

const skipLabels: Record<"ja" | "vi", string> = {
  ja: ja.a11y.skipToContent,
  vi: vi.a11y.skipToContent
};

/** Session cookies must be evaluated per request; avoid static shell mismatches with auth. */
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return [{ locale: "vi" }, { locale: "ja" }];
}

export default async function LearnerLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const loc = locale as "ja" | "vi";
  const skipLabel = skipLabels[loc] ?? vi.a11y.skipToContent;
  const t = loc === "ja" ? ja : vi;
  const jar = await cookies();
  const kcAccessCookiePresent = Boolean(jar.get(KC_COOKIE.access)?.value);

  return (
    <div lang={locale as SupportedLocale}>
      <a className="skip-to-content" href="#main">
        {skipLabel}
      </a>
      <PwaRegister />
      <KeycloakAuthShell kcAccessCookiePresent={kcAccessCookiePresent} locale={locale} nav={t.nav}>
        <div className="site-root" id="main" tabIndex={-1}>
          {children}
        </div>
      </KeycloakAuthShell>
    </div>
  );
}
