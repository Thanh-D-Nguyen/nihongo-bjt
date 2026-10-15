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

export function AccountsSettingsClient({ labels }: { labels: AccountsLabels }) {
  const { userId } = useGoAuth();
  const [identities, setIdentities] = useState<IdentityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadIdentities = useCallback(async () => {
    const uid = userId;
    if (!uid) {
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
      setError("load");
    }
  }, [userId]);

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
      setError("unlink");
    }
  }

  return (
    <div className="space-y-5">
      {error ? <p role="alert">{error}</p> : null}
      {identities && identities.length === 0 ? <p>{labels.identitiesEmpty}</p> : null}
      {identities && identities.length > 0 ? (
        <ul className="flex list-none flex-col gap-3 p-0">
          {identities.map((row) => (
            <li
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-paper/50 p-3"
              key={row.id}
            >
              <span className="text-sm text-ink">
                {row.provider} {row.emailAtLink ? `(${row.emailAtLink})` : ""}
              </span>
              <button
                className="min-h-12 rounded-lg border border-ink/12 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface"
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
