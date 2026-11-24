"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useGoAuth } from "../../../../lib/go-auth-provider";
import { learnerApiFetchOptional } from "../../../../lib/learner-api";
import { AdSlot, type AdSlotLabels } from "../ads/ad-slot";
import type { HomepageLabels, LearnerAnalytics, NhkArticle } from "./types";
import { PushPromptBanner, type PushBannerLabels } from "./push-prompt-banner";
import { OnboardingFlow } from "./onboarding-flow";
import { TodayPlanHub } from "./today-plan-hub";

interface DailyHubPayload {
  dueReviews: number;
  greeting: { japanese: string; reading: string | null };
  today: string;
}

export function HomepageClient({
  adLabels,
  labels,
  locale,
  pushBannerLabels
}: {
  adLabels: AdSlotLabels;
  labels: HomepageLabels;
  locale: string;
  pushBannerLabels: PushBannerLabels;
}) {
  const auth = useGoAuth();
  const userId = auth.userId ?? "";
  const isLoggedIn = Boolean(userId);

  const [hub, setHub] = useState<DailyHubPayload | null>(null);
  const [hubError, setHubError] = useState(false);
  const [hubReady, setHubReady] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [nhkArticles, setNhkArticles] = useState<NhkArticle[]>([]);
  const [nhkReady, setNhkReady] = useState(false);
  const [nhkError, setNhkError] = useState(false);
  const [analytics, setAnalytics] = useState<LearnerAnalytics | null>(null);
  const [analyticsReady, setAnalyticsReady] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const loadData = useCallback(() => {
    if (auth.isLoading) return;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo";
    setHubReady(false);
    setNhkReady(false);
    setAnalyticsReady(false);

    void learnerApiFetchOptional(
      `/api/daily/home?locale=${locale}&timeZone=${encodeURIComponent(timeZone)}${userId ? `&userId=${encodeURIComponent(userId)}` : ""}`
    )
      .then(async (r) => {
        if (r?.ok) {
          setHub(await r.json());
          setHubError(false);
        } else {
          setHub(null);
          setHubError(true);
        }
      })
      .catch(() => {
        setHub(null);
        setHubError(true);
      })
      .finally(() => setHubReady(true));

    void learnerApiFetchOptional(`/api/nhk-news?type=easy&limit=3&locale=${locale}`)
      .then(async (response) => {
        if (!response?.ok) throw new Error("News request failed");
        const articles = await response.json();
        setNhkArticles(Array.isArray(articles) ? articles.slice(0, 3) : []);
        setNhkError(false);
      })
      .catch(() => setNhkError(true))
      .finally(() => setNhkReady(true));

    if (userId) {
      setAnalyticsReady(false);
      setAnalyticsError(false);
      void learnerApiFetchOptional(
        `/api/analytics/learner?days=7&userId=${encodeURIComponent(userId)}&locale=${locale}`
      )
        .then(async (r) => {
          if (r?.ok) {
            setAnalytics(await r.json());
            setAnalyticsError(false);
          } else {
            setAnalytics(null);
            setAnalyticsError(true);
          }
        })
        .catch(() => {
          setAnalytics(null);
          setAnalyticsError(true);
        })
        .finally(() => setAnalyticsReady(true));
    } else {
      setAnalytics(null);
      setAnalyticsError(false);
      setAnalyticsReady(true);
    }
  }, [auth.isLoading, locale, userId]);

  // Check onboarding status for logged-in users
  useEffect(() => {
    if (!userId) return;
    void learnerApiFetchOptional("/api/recommendation/onboarding/status")
      .then(async (r) => {
        if (r?.ok) {
          const data = await r.json();
          if (!data.completed) setShowOnboarding(true);
        }
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const apply = () => setIsOffline(!window.navigator.onLine);
    apply();
    window.addEventListener("online", apply);
    window.addEventListener("offline", apply);
    return () => {
      window.removeEventListener("online", apply);
      window.removeEventListener("offline", apply);
    };
  }, []);

  if (auth.isLoading) {
    return (
      <main aria-busy="true" className="space-y-6 py-6">
        <div className="h-72 animate-pulse rounded-2xl bg-border" />
        <p className="sr-only">{labels.sectionLoadingHint}</p>
      </main>
    );
  }

  const visibleArticles = nhkArticles.slice(0, 3);

  return (
    <main className="min-w-0 space-y-8 overflow-x-clip pb-12 pt-2 sm:space-y-10 sm:pt-6">
      {showOnboarding && <OnboardingFlow onComplete={() => setShowOnboarding(false)} />}
      <PushPromptBanner labels={pushBannerLabels} />

      <div className="hp-enter">
        <TodayPlanHub
          analytics={analytics}
          analyticsError={analyticsError}
          analyticsReady={analyticsReady}
          hub={hub}
          hubError={hubError}
          hubReady={hubReady}
          isLoggedIn={isLoggedIn}
          isOffline={isOffline}
          labels={labels}
          locale={locale}
          onRetry={loadData}
        />
      </div>

      <section
        aria-labelledby="homepage-reading-heading"
        className="hp-enter hp-enter-d2 mx-auto w-full max-w-[1280px]"
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink sm:text-xl" id="homepage-reading-heading">
              {labels.readingStripTitle}
            </h2>
            <p className="mt-1 text-sm text-muted">{labels.readingStripSub}</p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-accent underline decoration-border underline-offset-4 transition-colors hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            href={`/${locale}/news`}
          >
            {labels.newsViewAll}
          </Link>
        </div>

        {!nhkReady ? (
          <div aria-busy="true" className="grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                className="h-[116px] animate-pulse rounded-xl bg-surface ring-1 ring-border"
                key={item}
              />
            ))}
            <p className="sr-only">{labels.sectionLoadingHint}</p>
          </div>
        ) : nhkError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3.5 text-sm text-ink ring-1 ring-border">
            <span>{labels.newsError}</span>
            <button
              className="inline-flex min-h-11 items-center rounded-lg bg-paper px-3.5 text-sm font-semibold text-ink ring-1 ring-border transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              onClick={loadData}
              type="button"
            >
              {labels.todayPlan.errorCta}
            </button>
          </div>
        ) : visibleArticles.length === 0 ? (
          <div className="rounded-xl bg-surface px-4 py-4 text-sm text-muted ring-1 ring-border">
            {labels.newsEmpty}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {visibleArticles.map((article) => (
              <Link
                className="group flex min-h-[116px] flex-col justify-between rounded-xl bg-surface p-4 text-ink shadow-xs ring-1 ring-border transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                href={`/${locale}/news/${article.id}`}
                key={article.id}
              >
                <div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-muted">
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-brand-accent">
                      {labels.newsEasy}
                    </span>
                    {article.difficulty ? <span>{article.difficulty}</span> : null}
                  </div>
                  <h3
                    className="jp-text mt-2.5 line-clamp-2 text-sm font-bold leading-[1.8] text-ink"
                    lang="ja"
                  >
                    {article.title}
                  </h3>
                </div>
                <span className="mt-3 inline-flex items-center text-xs font-semibold text-muted transition-colors group-hover:text-ink">
                  {labels.newsReadMore}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <AdSlot
        className="hp-enter hp-enter-d2 mx-auto w-full max-w-[1280px]"
        labels={adLabels}
        locale={locale}
        placementCode="home_feed_inline"
      />
    </main>
  );
}
