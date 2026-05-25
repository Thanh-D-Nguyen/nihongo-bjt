"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useKeycloakAuth } from "../../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../../lib/learner-api";
import { toIntlLocale } from "@/lib/locale-utils";

type SubscriptionData = {
  planSlug: string;
  planName: string;
  planNameVi?: string;
  planNameJa?: string;
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

const ENTITLEMENT_LABELS: Record<string, Record<string, string>> = {
  vi: {
    "learner.basic": "Tính năng học cơ bản",
    "flashcard.deck.create": "Tạo bộ thẻ",
    "flashcard.suggest_cards": "Gợi ý thẻ AI",
    "flashcard.adaptive_gen": "Tạo thẻ thích ứng",
    "quiz.bjt.start": "Làm bài kiểm tra BJT",
    "quiz.official_simulation": "Mô phỏng BJT chính thức",
    "ads.remove": "Xóa hoàn toàn quảng cáo",
    "ads.reduced": "Giảm quảng cáo",
  },
  ja: {
    "learner.basic": "基本学習機能",
    "flashcard.deck.create": "デッキ作成",
    "flashcard.suggest_cards": "AIカード提案",
    "flashcard.adaptive_gen": "アダプティブ生成",
    "quiz.bjt.start": "BJTクイズ",
    "quiz.official_simulation": "公式BJTシミュレーション",
    "ads.remove": "広告完全非表示",
    "ads.reduced": "広告削減",
  },
};

const QUOTA_LABELS: Record<string, Record<string, string>> = {
  vi: {
    "flashcard_reviews_per_day": "Ôn tập thẻ flashcard",
  },
  ja: {
    "flashcard_reviews_per_day": "フラッシュカード復習",
  },
};

const WINDOW_LABELS: Record<string, Record<string, string>> = {
  vi: { day: "ngày", week: "tuần", month: "tháng" },
  ja: { day: "日", week: "週", month: "月" },
};

export function SubscriptionSettingsClient({ labels, locale }: { labels: Labels; locale: string }) {
  const { userId } = useKeycloakAuth();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const entitlementLabel = (key: string) => ENTITLEMENT_LABELS[locale]?.[key] ?? ENTITLEMENT_LABELS.vi[key] ?? key;
  const quotaLabel = (key: string) => QUOTA_LABELS[locale]?.[key] ?? QUOTA_LABELS.vi[key] ?? key;
  const windowLabel = (w: string) => WINDOW_LABELS[locale]?.[w] ?? WINDOW_LABELS.vi[w] ?? w;

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
    setCanceling(true);
    try {
      const res = await learnerApiFetch("/api/learner/monetization/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setCancelSuccess(true);
        setShowCancelConfirm(false);
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
      <main className="w-full space-y-6 pb-12">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-48 rounded bg-ink/8" />
          <div className="h-40 rounded-2xl bg-ink/5" />
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="w-full space-y-6 pb-12 text-center">
        <p className="text-sm text-sakura">{labels.error}</p>
      </main>
    );
  }

  const isFree = data.source === "default";
  const periodEnd = data.currentPeriodEnd ? new Date(data.currentPeriodEnd).toLocaleDateString(toIntlLocale(locale)) : null;

  return (
    <main className="w-full space-y-6 pb-12">
      <h1 className="text-2xl font-bold text-ink">{labels.title}</h1>
      <p className="mt-1 text-sm text-muted">{labels.subtitle}</p>

      <div className="mt-2 rounded-2xl border border-ink/8 bg-surface p-6 shadow-sm">
        {/* Plan info */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">{labels.currentPlan}</p>
            <h2 className="mt-1 text-xl font-bold text-ink">{locale === "ja" ? (data.planNameJa ?? data.planName) : (data.planNameVi ?? data.planName)}</h2>
          </div>
          {!isFree && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
              data.cancelAtPeriodEnd
                ? "bg-sakura/10 text-sakura"
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
                  <span className="h-1.5 w-1.5 rounded-full bg-leaf" />
                  {entitlementLabel(e)}
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
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {quotaLabel(q.key)}: {q.limit >= 999999 ? labels.unlimited : `${q.limit}/${windowLabel(q.window)}`}
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
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-surface hover:bg-accent/90 transition-colors"
                href={`/${locale}/pricing`}
              >
                {labels.upgradeCta}
              </Link>
            </>
          ) : !data.cancelAtPeriodEnd ? (
            <div className="space-y-3">
              {!showCancelConfirm ? (
                <button
                  className="rounded-xl border border-sakura/30 px-4 py-2 text-sm font-medium text-sakura hover:bg-sakura/5 transition-colors"
                  onClick={() => setShowCancelConfirm(true)}
                  type="button"
                >
                  {labels.cancelButton}
                </button>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-sakura/20 bg-sakura/5 p-3">
                  <p className="text-sm text-ink">{labels.cancelConfirm}</p>
                  <button
                    className="shrink-0 rounded-lg bg-sakura px-3 py-1.5 text-xs font-semibold text-surface hover:bg-sakura/90 disabled:opacity-50 transition-colors"
                    disabled={canceling}
                    onClick={() => void handleCancel()}
                    type="button"
                  >
                    {canceling ? "..." : labels.cancelButton}
                  </button>
                  <button
                    className="shrink-0 rounded-lg border border-ink/12 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper transition-colors"
                    onClick={() => setShowCancelConfirm(false)}
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ) : null}
          {cancelSuccess && (
            <span className="text-sm text-leaf">{labels.cancelSuccess}</span>
          )}
        </div>
      </div>

      <Link className="text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline" href={`/${locale}/settings`}>
        ← {labels.backToSettings}
      </Link>
    </main>
  );
}
