"use client";

import { AppShell, cn } from "@nihongo-bjt/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { useKeycloakAuth } from "../../components/auth/keycloak-auth-provider";

export type LearnerNavLabels = {
  analytics: string;
  ariaMain: string;
  battle: string;
  brand: string;
  home: string;
  quiz: string;
  review: string;
  search: string;
  sessionChecking: string;
  settings: string;
  signOut: string;
  signIn: string;
  userFallback: string;
};

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

export function LearnerAppFrame({
  children,
  locale,
  nav
}: {
  children: ReactNode;
  locale: string;
  nav: LearnerNavLabels;
}) {
  const pathname = normalizePath(usePathname() ?? "");
  const base = `/${locale}`;
  const {
    accessToken,
    displayName,
    email,
    kcAccessCookiePresent,
    loading: authLoading,
    logout,
    sessionFailedWithCookie
  } = useKeycloakAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const hideChrome = pathname === `${base}/login` || pathname === `${base}/register`;
  const navItems = useMemo(() => {
    return [
      { href: base, label: nav.home },
      { href: `${base}/flashcards`, label: nav.review },
      { href: `${base}/quiz`, label: nav.quiz },
      { href: `${base}/battle`, label: nav.battle },
      { href: `${base}/search`, label: nav.search },
      { href: `${base}/analytics`, label: nav.analytics },
      { href: `${base}/settings`, label: nav.settings }
    ];
  }, [base, nav]);

  const linkActive = (href: string) => {
    if (href === base) {
      return pathname === base;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  if (hideChrome) {
    return <>{children}</>;
  }

  const userLabel = displayName || email || nav.userFallback;
  const userInitial = userLabel.trim().charAt(0).toUpperCase() || "N";

  return (
    <AppShell>
      <header className="mb-6 border-b border-ink/10 pb-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link className="text-sm font-semibold tracking-tight text-ink" href={base}>
              {nav.brand}
            </Link>
            <div className="flex min-h-8 flex-wrap items-center gap-3">
              {mounted && authLoading && kcAccessCookiePresent ? (
                <span className="text-xs font-medium text-muted" role="status">
                  {nav.sessionChecking}
                </span>
              ) : null}
              {mounted && accessToken ? (
                <div className="flex min-w-0 items-center gap-2 rounded-full border border-ink/10 bg-surface px-2 py-1 shadow-sm">
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-surface"
                  >
                    {userInitial}
                  </span>
                  <span className="max-w-[10rem] truncate text-xs font-semibold text-ink">
                    {userLabel}
                  </span>
                  <button
                    className="rounded-full px-2 py-1 text-xs font-semibold text-muted hover:bg-ink/5 hover:text-ink"
                    type="button"
                    onClick={logout}
                  >
                    {nav.signOut}
                  </button>
                </div>
              ) : null}
              {mounted &&
              !authLoading &&
              !accessToken &&
              (!kcAccessCookiePresent || sessionFailedWithCookie) ? (
                <Link
                  className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-ink/5"
                  href={`${base}/login`}
                >
                  {nav.signIn}
                </Link>
              ) : null}
            </div>
          </div>
          <nav aria-label={nav.ariaMain} className="flex flex-wrap gap-x-5 gap-y-2">
            {navItems.map((item) => (
              <Link
                className={cn(
                  "border-b-2 pb-1 text-sm font-medium transition-colors",
                  linkActive(item.href)
                    ? "border-accent text-ink"
                    : "border-transparent text-muted hover:border-ink/20 hover:text-ink"
                )}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {children}
    </AppShell>
  );
}
