import { isSupportedLocale, type SupportedLocale } from "@nihongo-bjt/config";
import { notFound } from "next/navigation";
import en from "../../messages/en.json";
import ja from "../../messages/ja.json";
import vi from "../../messages/vi.json";
import { AdminSessionGate } from "../_components/admin-session-gate";
import { AdminShellClient } from "../_components/admin-shell-client";

const messages = { ja, vi, en };

// Force dynamic rendering so server-side cookie reads reflect
// the freshly-set Set-Cookie from POST /api/admin/login on the
// very next navigation.
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

  return (
    <div lang={locale} className="contents">
      <AdminSessionGate
        busyLabel={t.shell.sessionChecking}
        locale={locale}
      >
        <AdminShellClient chrome={chrome} locale={locale} navLabelMaps={navLabelMaps}>
          {children}
        </AdminShellClient>
      </AdminSessionGate>
    </div>
  );
}