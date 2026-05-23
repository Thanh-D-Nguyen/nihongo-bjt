"use client";

import { Card, CardContent, PageHeader, SectionHeader, Toggle } from "@nihongo-bjt/ui";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { useKeycloakAuth } from "../../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../../lib/learner-api";
import { usePushSubscription } from "../../../../_hooks/use-push-subscription";

export type NotificationsLabels = {
  email: string;
  emptyFeed: string;
  error: string;
  feedTitle: string;
  saveSuccess: string;
  inApp: string;
  load: string;
  markRead: string;
  productNews: string;
  pushActive: string;
  pushDescription: string;
  pushDisable: string;
  pushEnable: string;
  pushTitle: string;
  pushUnsupported: string;
  save: string;
  study: string;
  subtitle: string;
  title: string;
  userId: string;
};

type Prefs = {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  productNewsEnabled: boolean;
  studyRemindersEnabled: boolean;
};

type Feed = {
  createdAt: string;
  id: string;
  kind: string;
  payload: unknown;
  readAt: string | null;
};

export function NotificationsSettingsClient({ labels }: { labels: NotificationsLabels }) {
  const { userId } = useKeycloakAuth();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [feed, setFeed] = useState<Feed[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const push = usePushSubscription(userId);

  const loadAll = useCallback(async () => {
    const uid = userId;
    if (!uid) {
      return;
    }
    setError(null);
    setSaved(false);
    try {
      const [p, f] = await Promise.all([
        learnerApiFetch(`/api/learner/notification-preferences?userId=${encodeURIComponent(uid)}`),
        learnerApiFetch(
          `/api/learner/in-app-notifications?userId=${encodeURIComponent(uid)}&limit=20`
        )
      ]);
      if (!p.ok || !f.ok) {
        throw new Error("load");
      }
      setPrefs((await p.json()) as Prefs);
      setFeed((await f.json()) as Feed[]);
    } catch {
      setError(labels.error);
    }
  }, [labels.error, userId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function savePrefs(e: FormEvent) {
    e.preventDefault();
    const uid = userId;
    if (!uid || !prefs) {
      return;
    }
    setError(null);
    try {
      const r = await learnerApiFetch("/api/learner/notification-preferences", {
        body: JSON.stringify({ ...prefs, userId: uid }),
        headers: { "Content-Type": "application/json" },
        method: "PUT"
      });
      if (!r.ok) {
        throw new Error("save");
      }
      setSaved(true);
    } catch {
      setError(labels.error);
    }
  }

  async function readOne(id: string) {
    const uid = userId;
    if (!uid) {
      return;
    }
    try {
      const r = await learnerApiFetch(`/api/learner/in-app-notifications/${id}/read`, {
        body: JSON.stringify({ userId: uid }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (r.ok) {
        setFeed((current) =>
          current.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
        );
      }
    } catch {
      setError(labels.error);
    }
  }

  return (
    <main className="w-full space-y-6 pb-12">
      <PageHeader description={labels.subtitle} title={labels.title} />
      <Card className="border-ink/10 shadow-sm">
        <CardContent className="space-y-6 p-5 sm:p-6">
          {error ? (
            <p className="text-sm text-sakura" role="alert">
              {labels.error}
            </p>
          ) : null}
          {prefs ? (
            <form
              className="space-y-1 rounded-xl border border-ink/10 bg-paper/50 p-4"
              onSubmit={savePrefs}
            >
              <Toggle
                checked={prefs.studyRemindersEnabled}
                label={labels.study}
                onChange={(v) => setPrefs({ ...prefs, studyRemindersEnabled: v })}
              />
              <Toggle
                checked={prefs.inAppEnabled}
                label={labels.inApp}
                onChange={(v) => setPrefs({ ...prefs, inAppEnabled: v })}
              />
              <Toggle
                checked={prefs.emailEnabled}
                label={labels.email}
                onChange={(v) => setPrefs({ ...prefs, emailEnabled: v })}
              />
              <Toggle
                checked={prefs.productNewsEnabled}
                label={labels.productNews}
                onChange={(v) => setPrefs({ ...prefs, productNewsEnabled: v })}
              />
              <div className="pt-3">
                <button
                  className="rounded-xl border border-ink/15 bg-ink px-4 py-2 text-sm font-semibold text-surface hover:bg-ink/90"
                  type="submit"
                >
                  {labels.save}
                </button>
              </div>
              {saved ? (
                <p className="text-sm text-muted" role="status">
                  {labels.saveSuccess}
                </p>
              ) : null}
            </form>
          ) : null}
          <section className="space-y-3 rounded-xl border border-ink/10 bg-paper/50 p-4">
            <SectionHeader heading="h3" title={labels.pushTitle} />
            {!push.isSupported ? (
              <p className="text-sm text-muted">{labels.pushUnsupported}</p>
            ) : push.loading ? (
              <p className="text-sm text-muted">…</p>
            ) : push.isSubscribed ? (
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted">✅ {labels.pushActive}</p>
                <button
                  className="rounded-lg border border-ink/12 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper"
                  onClick={() => void push.unsubscribe()}
                  type="button"
                >
                  {labels.pushDisable}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted">{labels.pushDescription}</p>
                <button
                  className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-surface hover:bg-ink/90"
                  onClick={() => void push.subscribe()}
                  type="button"
                >
                  {labels.pushEnable}
                </button>
              </div>
            )}
          </section>
          <section>
            <SectionHeader heading="h2" title={labels.feedTitle} />
            {feed.length === 0 ? <p className="text-sm text-muted">{labels.emptyFeed}</p> : null}
            <ul className="mt-3 flex list-none flex-col gap-3 p-0">
              {feed.map((n) => (
                <li
                  className={`rounded-xl border p-4 transition-colors ${
                    n.readAt
                      ? "border-ink/6 bg-paper/30"
                      : "border-accent/20 bg-accent/4"
                  }`}
                  key={n.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink capitalize">
                        {n.kind.replace(/_/g, " ")}
                      </p>
                      {n.payload && typeof n.payload === "object" && "message" in (n.payload as Record<string, unknown>) ? (
                        <p className="mt-1 text-sm text-muted">
                          {String((n.payload as Record<string, unknown>).message)}
                        </p>
                      ) : null}
                      <p className="mt-1.5 text-xs text-muted/70">
                        {new Date(n.createdAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {n.readAt ? (
                      <span className="shrink-0 text-xs text-muted/50">✓</span>
                    ) : (
                      <button
                        className="shrink-0 rounded-lg border border-ink/12 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper"
                        onClick={() => void readOne(n.id)}
                        type="button"
                      >
                        {labels.markRead}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </CardContent>
      </Card>
    </main>
  );
}
