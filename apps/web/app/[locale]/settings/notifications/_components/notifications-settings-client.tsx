"use client";

import { Card, CardContent, PageHeader, SectionHeader } from "@nihongo-bjt/ui";
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
          <button
            className="rounded-xl border border-ink/15 bg-ink px-4 py-2 text-sm font-semibold text-surface hover:bg-ink/90 disabled:opacity-50"
            disabled={!userId}
            type="button"
            onClick={() => void loadAll()}
          >
            {labels.load}
          </button>
          {error ? (
            <p className="text-sm text-sakura" role="alert">
              {labels.error}
            </p>
          ) : null}
          {prefs ? (
            <form
              className="space-y-3 rounded-xl border border-ink/10 bg-paper/50 p-4"
              onSubmit={savePrefs}
            >
              <label>
                <input
                  checked={prefs.studyRemindersEnabled}
                  onChange={(e) => setPrefs({ ...prefs, studyRemindersEnabled: e.target.checked })}
                  type="checkbox"
                />{" "}
                {labels.study}
              </label>
              <label>
                <input
                  checked={prefs.inAppEnabled}
                  onChange={(e) => setPrefs({ ...prefs, inAppEnabled: e.target.checked })}
                  type="checkbox"
                />{" "}
                {labels.inApp}
              </label>
              <label>
                <input
                  checked={prefs.emailEnabled}
                  onChange={(e) => setPrefs({ ...prefs, emailEnabled: e.target.checked })}
                  type="checkbox"
                />{" "}
                {labels.email}
              </label>
              <label>
                <input
                  checked={prefs.productNewsEnabled}
                  onChange={(e) => setPrefs({ ...prefs, productNewsEnabled: e.target.checked })}
                  type="checkbox"
                />{" "}
                {labels.productNews}
              </label>
              <button
                className="rounded-xl border border-ink/15 bg-ink px-4 py-2 text-sm font-semibold text-surface hover:bg-ink/90"
                type="submit"
              >
                {labels.save}
              </button>
              {saved ? (
                <p className="text-sm text-muted" role="status">
                  {labels.saveSuccess}
                </p>
              ) : null}
            </form>
          ) : null}
          <section className="space-y-3 rounded-xl border border-ink/10 bg-paper/50 p-4">
            <SectionHeader heading="h3" title="Push Notifications" />
            {!push.isSupported ? (
              <p className="text-sm text-muted">Trình duyệt không hỗ trợ thông báo đẩy</p>
            ) : push.loading ? (
              <p className="text-sm text-muted">…</p>
            ) : push.isSubscribed ? (
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted">✅ Đang nhận thông báo</p>
                <button
                  className="rounded-lg border border-ink/12 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper"
                  onClick={() => void push.unsubscribe()}
                  type="button"
                >
                  Tắt
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted">Nhận thông báo Kanji mỗi ngày</p>
                <button
                  className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-surface hover:bg-ink/90"
                  onClick={() => void push.subscribe()}
                  type="button"
                >
                  Bật
                </button>
              </div>
            )}
          </section>
          <section>
            <SectionHeader heading="h2" title={labels.feedTitle} />
            {feed.length === 0 ? <p className="text-sm text-muted">{labels.emptyFeed}</p> : null}
            <ul className="mt-3 flex list-none flex-col gap-3 p-0">
              {feed.map((n) => (
                <li className="rounded-xl border border-ink/10 bg-surface p-4" key={n.id}>
                  <strong className="text-sm">{n.kind}</strong>
                  <pre className="mt-2 text-xs text-muted" style={{ whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(n.payload, null, 0)}
                  </pre>
                  {n.readAt ? null : (
                    <button
                      className="mt-3 rounded-lg border border-ink/12 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper"
                      onClick={() => void readOne(n.id)}
                      type="button"
                    >
                      {labels.markRead}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </CardContent>
      </Card>
    </main>
  );
}
