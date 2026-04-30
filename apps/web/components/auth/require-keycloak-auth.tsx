"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { isWebKeycloakEnabled } from "../../lib/public-keycloak";
import { useKeycloakAuth } from "./keycloak-auth-provider";

export function RequireKeycloakAuth({ locale, children }: { locale: string; children: ReactNode }) {
  const { loading, accessToken } = useKeycloakAuth();
  const router = useRouter();
  const enabled = isWebKeycloakEnabled();

  useEffect(() => {
    if (!enabled) return;
    if (loading) return;
    if (accessToken) return;
    const returnTo =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : `/${locale}`;
    router.replace(`/${locale}/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [accessToken, enabled, loading, locale, router]);

  if (enabled && (loading || !accessToken)) {
    return null;
  }

  return <>{children}</>;
}
