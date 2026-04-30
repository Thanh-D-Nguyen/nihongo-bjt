"use client";

import { Card, CardContent, PageHeader } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

import { useKeycloakAuth } from "../../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../../lib/learner-api";

export type PrivacyLabels = {
  consentHint: string;
  consentSave: string;
  consentSaved: string;
  consentTitle: string;
  consentToggle: string;
  delete: string;
  empty: string;
  error: string;
  export: string;
  listTitle: string;
  load: string;
  subtitle: string;
  title: string;
  userId: string;
};

type Row = {
  completedAt: string | null;
  createdAt: string;
  id: string;
  kind: string;
  status: string;
};

export function PrivacySettingsClient({ labels }: { labels: PrivacyLabels }) {
  const { userId } = useKeycloakAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [sharePostcardOptIn, setSharePostcardOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentSaved, setConsentSaved] = useState(false);

  const loadList = useCallback(async () => {
    const uid = userId;
    if (!uid) {
      return;
    }
    setError(null);
    try {
      const r = await learnerApiFetch(
        `/api/learner/privacy/requests?userId=${encodeURIComponent(uid)}`
      );
      if (!r.ok) {
        throw new Error("load");
      }
      setRows((await r.json()) as Row[]);
    } catch {
      setError(labels.error);
    }
  }, [labels.error, userId]);

  const loadConsent = useCallback(async () => {
    if (!userId) {
      return;
    }
    setError(null);
    try {
      const r = await learnerApiFetch("/api/auth/profile");
      if (!r.ok) {
        throw new Error("load-profile");
      }
      const body = (await r.json()) as { profile?: { sharePostcardOptIn?: boolean } };
      setSharePostcardOptIn(body.profile?.sharePostcardOptIn === true);
    } catch {
      setError(labels.error);
    }
  }, [labels.error, userId]);

  useEffect(() => {
    void loadList();
    void loadConsent();
  }, [loadConsent, loadList]);

  async function postKind(kind: "data_export" | "account_deletion") {
    const uid = userId;
    if (!uid) {
      return;
    }
    setError(null);
    try {
      const r = await learnerApiFetch("/api/learner/privacy/requests", {
        body: JSON.stringify({ kind, userId: uid }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!r.ok) {
        throw new Error("post");
      }
      await loadList();
    } catch {
      setError(labels.error);
    }
  }

  async function saveShareConsent() {
    if (!userId) {
      return;
    }
    setError(null);
    setConsentSaved(false);
    try {
      const r = await learnerApiFetch("/api/auth/profile", {
        body: JSON.stringify({ sharePostcardOptIn }),
        headers: { "Content-Type": "application/json" },
        method: "PUT"
      });
      if (!r.ok) {
        throw new Error("save-profile");
      }
      setConsentSaved(true);
    } catch {
      setError(labels.error);
    }
  }

  return (
    <main className="w-full space-y-6 pb-12">
      <PageHeader description={labels.subtitle} title={labels.title} />
      <Card className="border-ink/10 shadow-sm">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <section className="space-y-3 rounded-xl border border-ink/10 bg-paper/50 p-4">
            <h2 className="text-base font-semibold text-ink">{labels.consentTitle}</h2>
            <p className="text-sm text-muted">{labels.consentHint}</p>
            <label className="flex items-center gap-3 text-sm text-ink">
              <input
                checked={sharePostcardOptIn}
                className="h-4 w-4"
                disabled={!userId}
                onChange={(event) => setSharePostcardOptIn(event.target.checked)}
                type="checkbox"
              />
              <span>{labels.consentToggle}</span>
            </label>
            <button
              className="rounded-xl border border-ink/15 bg-ink px-4 py-2 text-sm font-semibold text-surface hover:bg-ink/90 disabled:opacity-50"
              disabled={!userId}
              type="button"
              onClick={() => void saveShareConsent()}
            >
              {labels.consentSave}
            </button>
            {consentSaved ? <p className="text-xs text-muted">{labels.consentSaved}</p> : null}
          </section>

          <button
            className="rounded-xl border border-ink/15 bg-ink px-4 py-2 text-sm font-semibold text-surface hover:bg-ink/90 disabled:opacity-50"
            disabled={!userId}
            type="button"
            onClick={() => void loadList()}
          >
            {labels.load}
          </button>
          {error ? (
            <p className="text-sm text-sakura" role="alert">
              {labels.error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-xl border border-ink/12 bg-paper px-4 py-2 text-sm font-semibold text-ink hover:bg-paper/80 disabled:opacity-50"
              disabled={!userId}
              onClick={() => void postKind("data_export")}
              type="button"
            >
              {labels.export}
            </button>
            <button
              className="rounded-xl border border-ink/12 bg-paper px-4 py-2 text-sm font-semibold text-ink hover:bg-paper/80 disabled:opacity-50"
              disabled={!userId}
              onClick={() => void postKind("account_deletion")}
              type="button"
            >
              {labels.delete}
            </button>
          </div>
          <h2 className="text-base font-semibold text-ink">{labels.listTitle}</h2>
          {rows.length === 0 ? <p className="text-sm text-muted">{labels.empty}</p> : null}
          <ul className="flex list-none flex-col gap-2 p-0">
            {rows.map((row) => (
              <li className="rounded-xl border border-ink/10 bg-paper/50 p-3 text-sm" key={row.id}>
                {row.kind} — {row.status}
                <br />
                <span className="text-xs text-muted">{row.createdAt}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
