"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useGoAuth } from "../../lib/go-auth-provider";

/**
 * Route guard that redirects unauthenticated users to /login.
 * Replaces Keycloak-based auth check with Go-native session cookie auth.
 * Name retained for backward compatibility; will be renamed in follow-up cleanup.
 */
export function RequireKeycloakAuth({ locale, children }: { locale: string; children: ReactNode }) {
  const { loading, isAuthenticated } = useGoAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (isAuthenticated) return;
    const returnTo =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : `/${locale}`;
    router.replace(`/${locale}/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [isAuthenticated, loading, locale, router]);

  if (loading || !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}