import { isSupportedLocale, type SupportedLocale } from "@nihongo-bjt/config";
import { isAccessTokenUsable } from "@nihongo-bjt/keycloak-oidc";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import en from "../../messages/en.json";
import ja from "../../messages/ja.json";
import vi from "../../messages/vi.json";
import { adminKcCookies } from "../../lib/kc-cookies";
import { AdminKeycloakSessionGate } from "../_components/admin-keycloak-session-gate";
import { AdminShellClient } from "../_components/admin-shell-client";

const messages = { ja, vi, en };

// Force dynamic rendering so server-side cookie reads reflect
// the freshly-set Set-Cookie from POST /api/auth/keycloak/password-login on the
// very next navigation. Without this, Next.js can serve a cached RSC payload
// where initialAuthed=false even though the browser already has the cookie,
// which contributed to the post-login redirect loop.
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return [{ locale: "vi" }, { locale: "ja" }, { locale: "en" }];
}

// All supported locales are fully accepted at runtime.

export default async function AdminLayout({
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

  const t = messages[locale as SupportedLocale] ?? messages.vi;

  const chrome = {
    brand: t.shell.brand,
    menuClose: t.shell.menuClose,
    menuOpen: t.shell.menuOpen,
    operationConsole: t.shell.operationConsole,
    rbacActive: t.shell.rbacActive,
    signOut: t.shell.signOut,
    workspace: t.shell.workspace,
    searchPlaceholder: t.shell.searchPlaceholder,
    searchClear: t.shell.searchClear,
    searchNoResults: t.shell.searchNoResults
  };
  const navLabelMaps = {
    navGroups: t.shell.navGroups,
    navItems: t.shell.navItems
  };

  // Optimistic gate: only render the shell immediately when the access token is
  // still locally usable. A stale access token or refresh-only cookie should stay
  // behind the session-check screen until the client validates/redirects, otherwise
  // unauthenticated visitors can briefly see the admin overview before /login.
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(adminKcCookies.access)?.value;
  const initialAuthed = Boolean(accessCookie && isAccessTokenUsable(accessCookie));

  return (
    <div lang={locale} className="contents">
      <AdminKeycloakSessionGate
        busyLabel={t.shell.sessionChecking}
        initialAuthed={initialAuthed}
        locale={locale}
      >
        <AdminShellClient chrome={chrome} locale={locale} navLabelMaps={navLabelMaps}>
          {children}
        </AdminShellClient>
      </AdminKeycloakSessionGate>
    </div>
  );
}
