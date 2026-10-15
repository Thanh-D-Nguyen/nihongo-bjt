"use client";

import { isSupportedLocale } from "@nihongo-bjt/config";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { adminApiFetch } from "../../../lib/admin-api";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";

const messages = { en, ja, vi };

function AdminLogout() {
  const requestedLocale = useSearchParams().get("locale") ?? "vi";
  const locale = isSupportedLocale(requestedLocale) ? requestedLocale : "vi";
  const t = messages[locale];
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const request = useRef<Promise<Response> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    // Reuse the pending request when React StrictMode replays the effect.
    request.current ??= adminApiFetch("/api/admin/logout", { method: "POST" });
    void request.current
      .then((response) => {
        if (cancelled) return;
        if (!response.ok) {
          setFailed(true);
          return;
        }
        window.location.assign(`/admin/${locale}/login`);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, locale]);

  return (
    <main
      aria-busy={!failed}
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center"
    >
      <h1 className="text-xl font-semibold">{t.shell.signOut}</h1>
      {failed ? (
        <>
          <p role="alert">{t.iam.adminManagement.errorMutation}</p>
          <button
            className="min-h-11 rounded-lg border px-4 py-2 focus-visible:ring-2"
            onClick={() => {
              request.current = null;
              setAttempt((value) => value + 1);
            }}
            type="button"
          >
            {t.shell.signOut}
          </button>
        </>
      ) : null}
    </main>
  );
}

export default function AdminLogoutPage() {
  return (
    <Suspense fallback={null}>
      <AdminLogout />
    </Suspense>
  );
}
