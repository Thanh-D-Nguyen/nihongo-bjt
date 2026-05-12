import { isSupportedLocale, type SupportedLocale } from "@nihongo-bjt/config";
import { isAccessTokenUsable } from "@nihongo-bjt/keycloak-oidc";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import ja from "../../messages/ja.json";
import vi from "../../messages/vi.json";
import { adminKcCookies } from "../../lib/kc-cookies";
import { AdminKeycloakSessionGate } from "../_components/admin-keycloak-session-gate";
import { AdminShellClient } from "../_components/admin-shell-client";

const messages = { ja, vi };

// Force dynamic rendering so server-side cookie reads reflect
// the freshly-set Set-Cookie from POST /api/auth/keycloak/password-login on the
// very next navigation. Without this, Next.js can serve a cached RSC payload
// where initialAuthed=false even though the browser already has the cookie,
// which contributed to the post-login redirect loop.
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  // Only vi/ja are first-class admin locales. `en` is accepted at runtime as a
  // login-screen-only fallback (see below); we deliberately do not pre-render
  // English admin shells.
  return [{ locale: "vi" }, { locale: "ja" }];
}

// Locales accepted at runtime. `en` is permitted so that the unauthenticated
// /en/login route can serve an English login screen; the shell strings on
// non-public /en/* routes will fall back to vi labels (the gate redirects
// unauthenticated visitors to /en/login before they ever see the shell).
const RUNTIME_LOCALES = ["vi", "ja", "en"] as const;
type RuntimeLocale = (typeof RUNTIME_LOCALES)[number];

function isRuntimeLocale(value: string): value is RuntimeLocale {
  return (RUNTIME_LOCALES as readonly string[]).includes(value);
}

export default async function AdminLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!isRuntimeLocale(locale)) {
    notFound();
  }

  // Shell chrome strings only exist for vi/ja. For `en` (login-only), fall back
  // to vi so the shared session-gate busy label still renders sensibly if the
  // gate ever runs on /en/* during transitions.
  const shellLoc: SupportedLocale = isSupportedLocale(locale) ? (locale as SupportedLocale) : "vi";
  const t = messages[shellLoc] ?? messages.vi;

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
