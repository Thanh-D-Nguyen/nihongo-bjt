"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";

type PlanData = {
  id: string;
  slug: string;
  nameKey: string;
  config: Record<string, unknown> | null;
  entitlements: string[];
  quotas: { key: string; limit: number; window: string }[];
};

type Labels = {
  title: string;
  subtitle: string;
  current: string;
  upgrade: string;
  free: string;
  features: string;
  perMonth: string;
  unlimited: string;
  quotaFormat: string;
  loading: string;
  error: string;
  backHome: string;
  enforcementOff: string;
  checkoutLoading?: string;
  checkoutError?: string;
  entitlementLabels?: Record<string, string>;
  quotaLabels?: Record<string, string>;
  windowLabels?: Record<string, string>;
};

export function PricingClient({ labels, locale }: { labels: Labels; locale: string }) {
  const { userId } = useKeycloakAuth();
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [enforcementEnabled, setEnforcementEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Human-readable labels for entitlement/quota keys
  const entitlementLabel = (key: string): string => {
    const map: Record<string, string> = {
      "learner.basic": locale === "ja" ? "基本学習機能" : "Tính năng học cơ bản",
      "flashcard.deck.create": locale === "ja" ? "デッキ作成" : "Tạo bộ thẻ",
      "flashcard.suggest_cards": locale === "ja" ? "AIカード提案" : "Gợi ý thẻ AI",
      "flashcard.adaptive_gen": locale === "ja" ? "アダプティブ生成" : "Tạo thẻ thích ứng",
      "quiz.bjt.start": locale === "ja" ? "BJTクイズ" : "Làm bài kiểm tra BJT",
      "quiz.official_simulation": locale === "ja" ? "公式BJTシミュレーション" : "Mô phỏng BJT chính thức",
      "ads.remove": locale === "ja" ? "広告完全非表示" : "Xóa hoàn toàn quảng cáo",
      "ads.reduced": locale === "ja" ? "広告削減" : "Giảm quảng cáo",
      ...(labels.entitlementLabels ?? {})
    };
    return map[key] ?? key;
  };

  const quotaLabel = (key: string): string => {
    const map: Record<string, string> = {
      "flashcard_reviews_per_day": locale === "ja" ? "フラッシュカード復習" : "Ôn thẻ flashcard",
      ...(labels.quotaLabels ?? {})
    };
    return map[key] ?? key;
  };

  const windowLabel = (w: string): string => {
    const map: Record<string, string> = {
      day: locale === "ja" ? "日" : "ngày",
      week: locale === "ja" ? "週" : "tuần",
      month: locale === "ja" ? "月" : "tháng",
      ...(labels.windowLabels ?? {})
    };
    return map[w] ?? w;
  };

  const load = useCallback(async () => {
    try {
      const [plansRes, summaryRes] = await Promise.all([
        learnerApiFetch("/api/learner/monetization/plans"),
        userId ? learnerApiFetch(`/api/learner/monetization/summary?userId=${encodeURIComponent(userId)}`) : null,
      ]);
      if (plansRes.ok) {
        setPlans((await plansRes.json()) as PlanData[]);
      }
      if (summaryRes?.ok) {
        const s = (await summaryRes.json()) as { planSlug?: string; enforcementEnabled?: boolean };
        setCurrentSlug(s.planSlug ?? null);
        setEnforcementEnabled(s.enforcementEnabled !== false);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  async function startCheckout(planSlug: string) {
    if (!userId) return;
    setCheckingOut(planSlug);
    setCheckoutError(null);
    try {
      const res = await learnerApiFetch("/api/learner/monetization/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug, userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        setCheckoutError(data.message ?? (labels.checkoutError || "Checkout failed"));
        return;
      }
      const data = (await res.json()) as { checkoutUrl?: string };
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl.startsWith("/")
          ? `/${locale}${data.checkoutUrl}`
          : data.checkoutUrl;
      } else {
        // Local checkout completed — reload to reflect new plan
        await load();
      }
    } catch {
      setCheckoutError(labels.checkoutError || "Checkout failed");
    } finally {
      setCheckingOut(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-slate-200" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-64 rounded-2xl bg-slate-100" />)}
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-12 text-center">
        <p className="text-sm text-rose-600">{labels.error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{labels.title}</h1>
        <p className="mt-2 text-sm text-muted">{labels.subtitle}</p>
        {!enforcementEnabled && (
          <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
            {labels.enforcementOff}
          </p>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.slug === currentSlug;
          const isFree = plan.slug === "free";
          const cfg = plan.config as { displayName?: string; displayNameVi?: string; displayNameJa?: string; price?: number; billingInterval?: string; recommended?: boolean } | null;
          const price = cfg?.price ?? 0;
          const recommended = cfg?.recommended ?? false;
          const displayName = locale === "ja" ? (cfg?.displayNameJa ?? cfg?.displayName) : (cfg?.displayNameVi ?? cfg?.displayName);

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-6 shadow-sm transition-shadow hover:shadow-md ${
                recommended ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200"
              }`}
            >
              {recommended && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-medium text-white">
                  ★
                </span>
              )}
              <h3 className="text-lg font-semibold text-ink">
                {displayName ?? plan.slug}
              </h3>
              <div className="mt-2">
                {isFree ? (
                  <span className="text-2xl font-bold text-ink">{labels.free}</span>
                ) : (
                  <span className="text-2xl font-bold text-ink">
                    {price.toLocaleString()}đ
                    <span className="text-sm font-normal text-muted">{labels.perMonth}</span>
                  </span>
                )}
              </div>

              <div className="mt-4 flex-1 space-y-2 text-sm text-muted">
                <p className="font-medium text-ink">{labels.features}:</p>
                {plan.quotas.map((q) => (
                  <p key={q.key} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    {quotaLabel(q.key)}: {q.limit >= 999999 ? labels.unlimited : `${q.limit}/${windowLabel(q.window)}`}
                  </p>
                ))}
                {plan.entitlements.map((e) => (
                  <p key={e} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                    {entitlementLabel(e)}
                  </p>
                ))}
              </div>

              <div className="mt-6">
                {isCurrent ? (
                  <span className="block w-full rounded-xl border border-slate-200 py-2.5 text-center text-sm font-medium text-muted">
                    {labels.current}
                  </span>
                ) : !isFree && enforcementEnabled ? (
                  <button
                    className="block w-full rounded-xl bg-indigo-600 py-2.5 text-center text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
                    disabled={checkingOut === plan.slug}
                    onClick={() => void startCheckout(plan.slug)}
                    type="button"
                  >
                    {checkingOut === plan.slug
                      ? (labels.checkoutLoading || "Đang xử lý...")
                      : labels.upgrade}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {checkoutError && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center">
          <p className="text-sm text-rose-700">{checkoutError}</p>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link className="text-sm text-indigo-600 hover:underline" href={`/${locale}`}>
          {labels.backHome}
        </Link>
      </div>
    </main>
  );
}
