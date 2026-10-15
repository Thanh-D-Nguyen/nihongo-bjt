"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { useGoAuth } from "../../../../lib/go-auth-provider";
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
  checkoutLoading?: string;
  checkoutError?: string;
  checkoutPending?: string;
  checkoutPendingShort?: string;
  retry?: string;
  signInToUpgrade?: string;
  entitlementLabels?: Record<string, string>;
  quotaLabels?: Record<string, string>;
  windowLabels?: Record<string, string>;
};

export function PricingClient({ labels, locale }: { labels: Labels; locale: string }) {
  const { userId } = useGoAuth();
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [pendingPlanSlug, setPendingPlanSlug] = useState<string | null>(null);

  // Human-readable labels for entitlement/quota keys
  const entitlementLabel = (key: string): string => {
    const text = (vi: string, ja: string, en: string) => locale === "ja" ? ja : locale === "vi" ? vi : en;
    const map: Record<string, string> = {
      "learner.basic": text("Tính năng học cơ bản", "基本学習機能", "Core learning features"),
      "flashcard.deck.create": text("Tạo bộ thẻ", "デッキ作成", "Create flashcard decks"),
      "flashcard.premium_styles": text("Giao diện thẻ cao cấp", "プレミアムカードデザイン", "Premium flashcard styles"),
      "flashcard.suggest_cards": text("Gợi ý thẻ AI", "AIカード提案", "AI flashcard suggestions"),
      "flashcard.adaptive_gen": text("Tạo thẻ thích ứng", "アダプティブ生成", "Adaptive card generation"),
      "quiz.bjt.start": text("Làm bài kiểm tra BJT", "BJTクイズ", "BJT quizzes"),
      "quiz.official_simulation": text("Mô phỏng BJT chính thức", "公式BJTシミュレーション", "Official BJT simulation"),
      "ads.remove": text("Xóa hoàn toàn quảng cáo", "広告完全非表示", "Remove ads"),
      "ads.reduced": text("Giảm quảng cáo", "広告削減", "Fewer ads"),
      ...(labels.entitlementLabels ?? {})
    };
    return map[key] ?? key;
  };

  const quotaLabel = (key: string): string => {
    const text = (vi: string, ja: string, en: string) => locale === "ja" ? ja : locale === "vi" ? vi : en;
    const map: Record<string, string> = {
      "flashcard_reviews_per_day": text("Ôn thẻ flashcard", "フラッシュカード復習", "Flashcard reviews"),
      "image_search_daily": text("Tìm ảnh mỗi ngày", "1日の画像検索", "Daily image searches"),
      ...(labels.quotaLabels ?? {})
    };
    return map[key] ?? key;
  };

  const windowLabel = (w: string): string => {
    const text = (vi: string, ja: string, en: string) => locale === "ja" ? ja : locale === "vi" ? vi : en;
    const map: Record<string, string> = {
      day: text("ngày", "日", "day"),
      week: text("tuần", "週", "week"),
      month: text("tháng", "月", "month"),
      ...(labels.windowLabels ?? {})
    };
    return map[w] ?? w;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [plansRes, subscriptionRes] = await Promise.all([
        learnerApiFetch("/api/learner/monetization/plans"),
        userId ? learnerApiFetch("/api/learner/monetization/subscription") : null,
      ]);
      if (!plansRes.ok || (subscriptionRes && !subscriptionRes.ok)) throw new Error("pricing request failed");
      const loadedPlans = await plansRes.json() as PlanData[];
	      const subscriptionData = subscriptionRes
	        ? await subscriptionRes.json() as {
	          subscription?: { planId: string; status: string } | null;
	          pendingSubscription?: { planId: string } | null;
	        }
        : null;
      setPlans(loadedPlans);
      const subscription = subscriptionData?.subscription;
      setCurrentSlug(subscription && ["active", "trialing"].includes(subscription.status)
        ? loadedPlans.find((plan) => plan.id === subscription.planId)?.slug ?? null
        : null);
	      const pendingSubscription = subscriptionData?.pendingSubscription;
	      setPendingPlanSlug(pendingSubscription
	        ? loadedPlans.find((plan) => plan.id === pendingSubscription.planId)?.slug ?? null
        : null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  async function startCheckout(plan: PlanData) {
    if (!userId) return;
    setCheckingOut(plan.slug);
    setCheckoutError(null);
    try {
      const res = await learnerApiFetch("/api/learner/monetization/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      if (!res.ok) {
        setCheckoutError(labels.checkoutError || "Checkout failed");
        return;
      }
      const data = await res.json() as { status?: string };
      if (data.status !== "pending") throw new Error("unexpected checkout status");
      setPendingPlanSlug(plan.slug);
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
        <button className="mt-4 rounded-xl border px-4 py-2 text-sm" onClick={() => void load()} type="button">
          {labels.retry || "Retry"}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{labels.title}</h1>
        <p className="mt-2 text-sm text-muted">{labels.subtitle}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.slug === currentSlug;
          const isFree = plan.slug === "free";
          const cfg = plan.config as { displayName?: string; displayNameVi?: string; displayNameJa?: string; price?: number; billingInterval?: string; recommended?: boolean } | null;
          const price = cfg?.price ?? 0;
          const recommended = cfg?.recommended ?? false;
          const displayName = locale === "ja"
            ? (cfg?.displayNameJa ?? cfg?.displayName)
            : locale === "vi" ? (cfg?.displayNameVi ?? cfg?.displayName) : cfg?.displayName;

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
                {(plan.quotas ?? []).map((q) => (
                  <p key={q.key} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    {quotaLabel(q.key)}: {q.limit >= 999999 ? labels.unlimited : `${q.limit}/${windowLabel(q.window)}`}
                  </p>
                ))}
                {(plan.entitlements ?? []).map((e) => (
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
                ) : !isFree ? (
                  userId ? <button
                    className="block w-full rounded-xl bg-indigo-600 py-2.5 text-center text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
                    disabled={checkingOut === plan.slug || pendingPlanSlug !== null}
                    onClick={() => void startCheckout(plan)}
                    type="button"
                  >
                    {checkingOut === plan.slug
                      ? (labels.checkoutLoading || "Đang xử lý...")
                      : pendingPlanSlug === plan.slug ? (labels.checkoutPendingShort || "Pending") : labels.upgrade}
                  </button> : <Link className="block w-full rounded-xl bg-indigo-600 py-2.5 text-center text-sm font-medium text-white" href={`/${locale}/login?returnTo=/${locale}/pricing`}>
                    {labels.signInToUpgrade || labels.upgrade}
                  </Link>
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
      {pendingPlanSlug && <p className="mt-4 text-center text-sm text-amber-700">{labels.checkoutPending}</p>}

      <div className="mt-8 text-center">
        <Link className="text-sm text-indigo-600 hover:underline" href={`/${locale}`}>
          {labels.backHome}
        </Link>
      </div>
    </main>
  );
}
