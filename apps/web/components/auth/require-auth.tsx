"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useGoAuth } from "../../lib/go-auth-provider";
import en from "../../messages/en.json";
import ja from "../../messages/ja.json";
import vi from "../../messages/vi.json";

const messages = { en, ja, vi };

/**
 * Route guard that redirects unauthenticated users to /login.
 * Replaces Keycloak-based auth check with Go-native session cookie auth.
 * Name retained for backward compatibility; will be renamed in follow-up cleanup.
 */
export function RequireAuth({ locale, children }: { locale: string; children: ReactNode }) {
  const { isLoading, loading, isAuthenticated } = useGoAuth();
  const checking = isLoading ?? loading;
  const router = useRouter();
  const t = messages[locale as keyof typeof messages] ?? vi;

  useEffect(() => {
    if (checking) return;
    if (isAuthenticated) return;
    const returnTo =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : `/${locale}`;
    router.replace(`/${locale}/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [checking, isAuthenticated, locale, router]);

  if (checking || !isAuthenticated) {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        className="mx-auto flex min-h-[50vh] w-full max-w-5xl flex-col gap-6 px-4 py-12"
        role="status"
      >
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-muted">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full bg-accent/60 animate-pulse motion-reduce:animate-none"
          />
          <span>{t.nav.sessionChecking}</span>
        </div>
        <div
          aria-hidden
          className="space-y-4 animate-pulse motion-reduce:animate-none"
        >
          <div className="h-8 w-48 rounded-xl bg-ink/10" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="h-32 rounded-2xl bg-ink/5" />
            <div className="h-32 rounded-2xl bg-ink/5" />
            <div className="h-32 rounded-2xl bg-ink/5" />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
