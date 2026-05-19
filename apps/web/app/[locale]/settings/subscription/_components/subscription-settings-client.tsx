"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useKeycloakAuth } from "../../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../../lib/learner-api";

type SubscriptionData = {
  planSlug: string;
  planName: string;
  source: "subscription" | "default";
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  entitlements: string[];
  quotas: { key: string; limit: number; window: string }[];
};

type Labels = {
  title: string;
  subtitle: string;
  currentPlan: string;
  status: string;
  renewsOn: string;
  cancelsOn: string;
  entitlements: string;
  quotas: string;
  unlimited: string;
  cancelButton: string;
  cancelConfirm: string;
  cancelSuccess: string;
  freePlanNote: string;
  upgradeCta: string;
  backToSettings: string;
  loading: string;
  error: string;
  active: string;
  trialing: string;
  canceled: string;
};

export function SubscriptionSettingsClient({ labels, locale }: { labels: Labels; locale: string }) {
  const { userId } = useKeycloakAuth();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const res = await learnerApiFetch(
        `/api/learner/monetization/subscription?userId=${encodeURIComponent(userId)}`
      );
      if (res.ok) {
        setData((await res.json()) as SubscriptionData);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  async function handleCancel() {
    if (!userId || !data?.status) return;
    const confirmed = window.confirm(labels.cancelConfirm);
    if (!confirmed) return;
    setCanceling(true);
    try {
      const res = await learnerApiFetch("/api/learner/monetization/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setCancelSuccess(true);
        setData((prev) => prev ? { ...prev, cancelAtPeriodEnd: true } : prev);
      }
    } catch { /* ignore */ } finally {
      setCanceling(false);
    }
  }

  const statusLabel = (s: string | null) => {
    if (!s) return "—";
    if (s === "active") return labels.active;
    if (s === "trialing") return labels.trialing;
    return labels.canceled;
  };

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-48 rounded bg-slate-200" />
          <div className="h-40 rounded-2xl bg-slate-100" />
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-12 text-center">
        <p className="text-sm text-rose-600">{labels.error}</p>
      </main>
    );
  }

  const isFree = data.source === "default";
  const periodEnd = data.currentPeriodEnd ? new Date(data.currentPeriodEnd).toLocaleDateString(locale === "ja" ? "ja-JP" : "vi-VN") : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-ink">{labels.title}</h1>
      <p className="mt-1 text-sm text-muted">{labels.subtitle}</p>

      <div className="mt-6 rounded-2xl border border-ink/8 bg-surface p-6 shadow-sm">
        {/* Plan info */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">{labels.currentPlan}</p>
            <h2 className="mt-1 text-xl font-bold text-ink">{data.planName}</h2>
          </div>
          {!isFree && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
              data.cancelAtPeriodEnd
                ? "bg-amber-50 text-amber-700"
                : "bg-leaf/10 text-leaf"
            }`}>
              {data.cancelAtPeriodEnd ? labels.canceled : statusLabel(data.status)}
            </span>
          )}
        </div>

        {/* Period */}
        {periodEnd && !isFree && (
          <p className="mt-3 text-sm text-muted">
            {data.cancelAtPeriodEnd ? labels.cancelsOn : labels.renewsOn}: <span className="font-medium text-ink">{periodEnd}</span>
          </p>
        )}

        {/* Entitlements */}
        {data.entitlements.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">{labels.entitlements}</p>
            <ul className="mt-2 space-y-1.5">
              {data.entitlements.map((e) => (
                <li key={e} className="flex items-center gap-2 text-sm text-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Quotas */}
        {data.quotas.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">{labels.quotas}</p>
            <ul className="mt-2 space-y-1.5">
              {data.quotas.map((q) => (
                <li key={q.key} className="flex items-center gap-2 text-sm text-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  {q.key}: {q.limit === 999999 ? labels.unlimited : `${q.limit}/${q.window}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-ink/6 pt-5">
          {isFree ? (
            <>
              <p className="text-sm text-muted">{labels.freePlanNote}</p>
              <Link
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                href={`/${locale}/pricing`}
              >
                {labels.upgradeCta}
              </Link>
            </>
          ) : !data.cancelAtPeriodEnd ? (
            <button
              className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              disabled={canceling}
              onClick={() => void handleCancel()}
              type="button"
            >
              {canceling ? "..." : labels.cancelButton}
            </button>
          ) : null}
          {cancelSuccess && (
            <span className="text-sm text-leaf">{labels.cancelSuccess}</span>
          )}
        </div>
      </div>

      <div className="mt-6">
        <Link className="text-sm text-muted hover:text-ink hover:underline" href={`/${locale}/settings`}>
          ← {labels.backToSettings}
        </Link>
      </div>
    </main>
  );
}
