"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { adminApiFetch } from "@/lib/admin-api";
import { isAdminKeycloakEnabled, isAdminTestBypassEnabled } from "@/lib/public-keycloak";

function isAdminPublicPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const page = segments[1];
  return page === "login" || page === "access-denied";
}

export function AdminKeycloakSessionGate({
  busyLabel,
  children,
  initialAuthed = false,
  locale
}: {
  busyLabel: string;
  children: ReactNode;
  initialAuthed?: boolean;
  locale: string;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const publicPath = isAdminPublicPath(pathname);
  const kc = isAdminKeycloakEnabled() && !isAdminTestBypassEnabled();
  // If KC cookies are present server-side, render optimistically and validate in background.
  const [ready, setReady] = useState(!kc || publicPath || initialAuthed);

  useEffect(() => {
    if (!kc) {
      setReady(true);
      return;
    }
    if (publicPath) {
      setReady(true);
      return;
    }

    let cancelled = false;
    // Do not flip ready→false when we already rendered optimistically; validate in the background
    // and only redirect on a real 401/403.
    if (!initialAuthed) {
      setReady(false);
    }

    void (async () => {
      try {
        // One request: adminApiFetch reuses a cached /api/auth/keycloak/session token
        // (avoids the previous double session round trip).
        let adminRes: Response;
        try {
          adminRes = await adminApiFetch("/api/admin/session");
        } catch (e) {
          if (cancelled) {
            return;
          }
          const msg = e instanceof Error ? e.message : "";
          if (msg === "admin_session_unauthorized") {
            router.replace(
              `/${locale}/login?returnTo=${encodeURIComponent(pathname || `/${locale}`)}`
            );
            return;
          }
          setReady(true);
          return;
        }

        if (cancelled) {
          return;
        }
        if (adminRes.status === 401) {
          const sessionRes = await fetch("/api/auth/keycloak/session", {
            credentials: "same-origin",
            signal: AbortSignal.timeout(12_000)
          }).catch(() => null);
          if (cancelled) {
            return;
          }
          if (sessionRes?.ok) {
            setReady(true);
            return;
          }
          router.replace(
            `/${locale}/login?returnTo=${encodeURIComponent(pathname || `/${locale}`)}`
          );
          return;
        }
        if (adminRes.status === 403) {
          router.replace(`/${locale}/access-denied`);
          return;
        }
        if (!adminRes.ok) {
          setReady(true);
          return;
        }
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
  }, [initialAuthed, kc, locale, pathname, publicPath, router]);

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
