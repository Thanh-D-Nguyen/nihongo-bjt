"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useKeycloakAuth } from "../../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../../lib/learner-api";

const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

interface AccountsLabels {
  connected: string;
  exchangeError: string;
  exchangeOk: string;
  googleCta: string;
  identitiesEmpty: string;
  subtitle: string;
  title: string;
  unlink: string;
  userId: string;
}

interface IdentityRow {
  createdAt: string;
  emailAtLink: string | null;
  id: string;
  provider: string;
}

/* ── Skeleton ── */

function AccountsSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-10 w-40 rounded-xl bg-ink/8" />
      <div className="h-14 rounded-xl bg-ink/6" />
      <div className="h-14 rounded-xl bg-ink/6" />
    </div>
  );
}

export function AccountsSettingsClient({
  labels,
  locale
}: {
  labels: AccountsLabels;
  locale: string;
}) {
  const searchParams = useSearchParams();
  const { userId } = useKeycloakAuth();
  const [identities, setIdentities] = useState<IdentityRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadIdentities = useCallback(async () => {
    const uid = userId;
    if (!uid) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const r = await learnerApiFetch(`/api/auth/identities?userId=${encodeURIComponent(uid)}`);
      if (!r.ok) {
        throw new Error("load_failed");
      }
      setIdentities((await r.json()) as IdentityRow[]);
    } catch {
      setError(labels.exchangeError);
    } finally {
      setLoading(false);
    }
  }, [userId, labels.exchangeError]);

  useEffect(() => {
    void loadIdentities();
  }, [loadIdentities]);

  useEffect(() => {
    const linkCode = searchParams.get("linkCode");
    const authError = searchParams.get("authError");
    if (authError) {
      setError(authError);
      return;
    }
    if (!linkCode) {
      return;
    }
    void (async () => {
      try {
        const r = await fetch(`${apiBase}/api/auth/link/exchange`, {
          body: JSON.stringify({ code: linkCode }),
          headers: { "Content-Type": "application/json" },
          method: "POST"
        });
        if (!r.ok) {
          setError(labels.exchangeError);
          return;
        }
        await r.json();
        setStatus(labels.exchangeOk);
        setIdentities(null);
        await loadIdentities();
      } catch {
        setError(labels.exchangeError);
      }
    })();
  }, [searchParams, labels.exchangeError, labels.exchangeOk]);

  async function unlink(id: string) {
    const uid = userId;
    if (!uid) {
      return;
    }
    setError(null);
    try {
      const r = await learnerApiFetch(
        `/api/auth/identities/${id}?userId=${encodeURIComponent(uid)}`,
        { method: "DELETE" }
      );
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { message?: string };
        setError(j.message ?? labels.exchangeError);
        return;
      }
      await loadIdentities();
    } catch {
      setError(labels.exchangeError);
    }
  }

  const ref =
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("ref") ??
        window.sessionStorage.getItem("referral_code") ??
        "")
      : "";

  const googleHref = `${apiBase}/api/auth/google/start?ui_locale=${encodeURIComponent(locale)}${
    ref ? `&ref=${encodeURIComponent(ref)}` : ""
  }`;

  return (
    <div className="space-y-5">
      <p>
        <a
          className="inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-ink px-4 py-2.5 text-sm font-semibold text-surface hover:bg-ink/90 transition-colors active:scale-[0.98]"
          href={googleHref}
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          {labels.googleCta}
        </a>
      </p>
      {status ? (
        <p className="rounded-lg bg-leaf/10 px-3 py-2 text-sm font-medium text-leaf" role="status">
          ✓ {status}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-sakura/10 px-3 py-2 text-sm font-medium text-sakura" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <AccountsSkeleton />
      ) : identities && identities.length === 0 ? (
        <p className="text-sm text-muted">{labels.identitiesEmpty}</p>
      ) : identities && identities.length > 0 ? (
        <ul className="flex list-none flex-col gap-3 p-0">
          {identities.map((row) => (
            <li
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-paper/50 p-4 transition-colors hover:border-ink/15"
              key={row.id}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-ink/8 text-sm">
                  {row.provider === "google" ? "G" : row.provider.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-medium text-ink capitalize">{row.provider}</p>
                  {row.emailAtLink && (
                    <p className="text-xs text-muted">{row.emailAtLink}</p>
                  )}
                </div>
              </div>
              <button
                className="rounded-lg border border-sakura/20 px-3 py-1.5 text-xs font-semibold text-sakura hover:bg-sakura/5 transition-colors"
                onClick={() => void unlink(row.id)}
                type="button"
              >
                {labels.unlink}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
