import { isSupportedLocale, type SupportedLocale } from "@nihongo-bjt/config";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import ja from "../../messages/ja.json";
import vi from "../../messages/vi.json";
import { learnerKcCookies } from "../../lib/kc-cookies";
import { KeycloakAuthShell } from "./_components/keycloak-auth-shell";
import { PwaRegister } from "../_components/pwa-register";
import { AmbientProvider } from "../_hooks/use-ambient-mode";
import { AmbientOverlay } from "../_components/ambient-overlay";
import { AmbientMiniPlayer } from "../_components/ambient-mini-player";

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
  const kcAccessCookiePresent = Boolean(jar.get(learnerKcCookies.access)?.value);

  return (
    <div lang={locale as SupportedLocale}>
      <a className="skip-to-content" href="#main">
        {skipLabel}
      </a>
      <PwaRegister />
      <AmbientProvider>
        <AmbientOverlay />
        <AmbientMiniPlayer labels={t.ambient} />
        <KeycloakAuthShell
          companionLabels={t.nav.companion}
          kcAccessCookiePresent={kcAccessCookiePresent}
          locale={locale}
          nav={t.nav}
          searchLabels={t.search}
        >
          <div className="site-root" id="main" tabIndex={-1}>
            {children}
          </div>
        </KeycloakAuthShell>
      </AmbientProvider>
    </div>
  );
}
