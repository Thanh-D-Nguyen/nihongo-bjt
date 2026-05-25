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
  const [status, setStatus] = useState<string | null>(null);
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
        setError(j.message ?? "unlink");
        return;
      }
      await loadIdentities();
    } catch {
      setError("unlink");
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
          className="inline-flex rounded-xl border border-ink/15 bg-ink px-4 py-2 text-sm font-semibold text-surface hover:bg-ink/90"
          href={googleHref}
        >
          {labels.googleCta}
        </a>
      </p>
      {status ? <p role="status">{status}</p> : null}
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
                className="rounded-lg border border-ink/12 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface"
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
