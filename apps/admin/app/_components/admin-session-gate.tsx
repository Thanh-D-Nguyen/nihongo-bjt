"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { adminApiFetch } from "@/lib/admin-api";

function isAdminPublicPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const page = segments[1];
  return page === "login" || page === "access-denied";
}

/**
 * Go-native admin session gate. Validates the admin session cookie by calling
 * GET /api/admin/session. Redirects to /login on 401, /access-denied on 403.
 * Replaces the previous Keycloak-based AdminKeycloakSessionGate.
 */
export function AdminSessionGate({
  busyLabel,
  children,
  locale
}: {
  busyLabel: string;
  children: ReactNode;
  locale: string;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const publicPath = isAdminPublicPath(pathname);
  const [ready, setReady] = useState(publicPath);

  useEffect(() => {
    if (publicPath) {
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);

    void (async () => {
      try {
        const res = await adminApiFetch("/api/admin/session");
        if (cancelled) return;

        if (res.status === 401) {
          router.replace(
            `/${locale}/login?returnTo=${encodeURIComponent(pathname || `/${locale}`)}`
          );
          return;
        }
        if (res.status === 403) {
          router.replace(`/${locale}/access-denied`);
          return;
        }
        // Any other status (200, 500, network error) — render the shell.
        // The shell itself handles missing permissions gracefully.
        setReady(true);
      } catch {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locale, pathname, publicPath, router]);

  if (!ready) {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        className="flex min-h-screen flex-col items-center justify-center gap-2 bg-paper px-4 text-center text-sm text-muted"
      >
        <span>{busyLabel}</span>
      </div>
    );
  }

  return <>{children}</>;
}