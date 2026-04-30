import { isSupportedLocale, type SupportedLocale } from "@nihongo-bjt/config";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ja from "../../messages/ja.json";
import vi from "../../messages/vi.json";
import { AdminKeycloakSessionGate } from "../_components/admin-keycloak-session-gate";
import { AdminShellClient } from "../_components/admin-shell-client";
import "../globals.css";

const messages = { ja, vi };

export const metadata: Metadata = {
  title: "NihonGo BJT Admin",
  description: "NihonGo BJT administration shell"
};

export function generateStaticParams() {
  return [{ locale: "vi" }, { locale: "ja" }];
}

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

  const loc = locale as "ja" | "vi";
  const t = messages[loc] ?? messages.vi;

  const chrome = {
    brand: t.shell.brand,
    menuClose: t.shell.menuClose,
    menuOpen: t.shell.menuOpen,
    operationConsole: t.shell.operationConsole,
    rbacActive: t.shell.rbacActive,
    signOut: t.shell.signOut,
    workspace: t.shell.workspace
  };
  const navLabelMaps = {
    navGroups: t.shell.navGroups,
    navItems: t.shell.navItems
  };

  return (
    <html lang={locale as SupportedLocale} suppressHydrationWarning>
      <body className="min-h-screen bg-paper text-ink antialiased" suppressHydrationWarning>
        <AdminKeycloakSessionGate busyLabel={t.shell.sessionChecking} locale={locale}>
          <AdminShellClient chrome={chrome} locale={locale} navLabelMaps={navLabelMaps}>
            {children}
          </AdminShellClient>
        </AdminKeycloakSessionGate>
      </body>
    </html>
  );
}
