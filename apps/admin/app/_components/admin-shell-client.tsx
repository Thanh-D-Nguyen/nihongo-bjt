"use client";

import {
  AdminShell,
  type AdminShellChromeLabels,
  type AdminNavGroupResolved
} from "@nihongo-bjt/ui";
import { usePathname } from "next/navigation";
import { Suspense, useMemo, useEffect, useState, type ReactNode } from "react";

import { ADMIN_NAV_DATA } from "@/lib/admin-nav-data";
import { readClientAdminFeatureFlags } from "@/lib/admin-feature-flags";
import { buildResolvedAdminNav, getShellNavLabel } from "@/lib/resolve-admin-nav";
import { adminApiFetch } from "@/lib/admin-api";
import { AdminContextualHelp } from "./admin-contextual-help";

function AdminShellWithPath({
  children,
  chrome,
  locale,
  navLabelMaps
}: {
  children: ReactNode;
  chrome: AdminShellChromeLabels;
  locale: string;
  navLabelMaps: { navGroups: Record<string, string>; navItems: Record<string, string> };
}) {
  const pathname = usePathname() ?? "";
  const [permissions, setPermissions] = useState<string[] | null>(null);
  const segments = pathname.split("/").filter(Boolean);
  const publicPath = segments[1] === "login" || segments[1] === "access-denied";

  const featureFlags = useMemo(() => readClientAdminFeatureFlags(), []);

  const navGroups: AdminNavGroupResolved[] = useMemo(
    () =>
      buildResolvedAdminNav(
        ADMIN_NAV_DATA,
        (key) => getShellNavLabel(navLabelMaps, key),
        locale,
        permissions,
        featureFlags
      ),
    [featureFlags, locale, navLabelMaps, permissions]
  );

  useEffect(() => {
    if (publicPath) {
      return;
    }
    let cancelled = false;
    void adminApiFetch("/api/admin/me")
      .then(async (res) => {
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as {
          roles?: Array<{ role?: { permissions?: Array<{ permission?: { code?: string } }> } }>;
        };
        const codes = new Set<string>();
        for (const actorRole of data.roles ?? []) {
          for (const link of actorRole.role?.permissions ?? []) {
            if (link.permission?.code) {
              codes.add(link.permission.code);
            }
          }
        }
        if (!cancelled) {
          setPermissions([...codes]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPermissions(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [publicPath]);

  if (publicPath) {
    return <>{children}</>;
  }
  const rest = segments.slice(1).join("/");
  const normalized = rest ? `/${rest}` : "/";

  return (
    <AdminShell chrome={chrome} locale={locale} navGroups={navGroups} normalizedPath={normalized}>
      {children}
      <div className="fixed bottom-5 right-5 z-40">
        <AdminContextualHelp locale={locale} />
      </div>
    </AdminShell>
  );
}

export function AdminShellClient({
  children,
  chrome,
  locale,
  navLabelMaps
}: {
  children: ReactNode;
  chrome: AdminShellChromeLabels;
  locale: string;
  navLabelMaps: { navGroups: Record<string, string>; navItems: Record<string, string> };
}) {
  return (
    <Suspense fallback={<div aria-hidden className="min-h-screen bg-paper" />}>
      <AdminShellWithPath chrome={chrome} locale={locale} navLabelMaps={navLabelMaps}>
        {children}
      </AdminShellWithPath>
    </Suspense>
  );
}
