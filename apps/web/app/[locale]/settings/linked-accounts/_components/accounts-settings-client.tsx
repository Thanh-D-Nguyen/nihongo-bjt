"use client";

import { useCallback, useEffect, useState } from "react";

import { useGoAuth } from "../../../../../lib/go-auth-provider";
import { learnerApiFetch } from "../../../../../lib/learner-api";

interface AccountsLabels {
  exchangeError: string;
  identitiesEmpty: string;
  unlink: string;
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
  labels
}: {
  labels: AccountsLabels;
}) {
  const { userId } = useGoAuth();
  const [identities, setIdentities] = useState<IdentityRow[] | null>(null);
  const [loading, setLoading] = useState(true);
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
        const j = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
        setError(j.error ?? j.message ?? labels.exchangeError);
        return;
      }
      await loadIdentities();
    } catch {
      setError(labels.exchangeError);
    }
  }

  return (
    <div className="space-y-5">
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
                className="min-h-12 rounded-lg border border-sakura/20 px-3 py-1.5 text-xs font-semibold text-sakura hover:bg-sakura/5 transition-colors"
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
