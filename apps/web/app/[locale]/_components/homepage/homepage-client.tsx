"use client";

import { useCallback, useEffect, useState } from "react";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetchOptional } from "../../../../lib/learner-api";
import type { HomepageLabels, LearnerAnalytics, NhkArticle } from "./types";
import { PushPromptBanner, type PushBannerLabels } from "./push-prompt-banner";
import { AdBanner } from "./ad-banner";
import { OnboardingFlow } from "./onboarding-flow";
import { HomepageSectionsTabs } from "./homepage-sections-tabs";
import { TodayPlanHub } from "./today-plan-hub";

interface DailyHubPayload {
  dueReviews: number;
  greeting: { japanese: string; reading: string };
  today: string;
}

export function HomepageClient({
  labels,
  locale,
  pushBannerLabels
}: {
  labels: HomepageLabels;
  locale: string;
  pushBannerLabels: PushBannerLabels;
}) {
  const auth = useKeycloakAuth();
  const userId = auth.userId ?? "";
  const isLoggedIn = Boolean(userId);

  const [hub, setHub] = useState<DailyHubPayload | null>(null);
  const [hubError, setHubError] = useState(false);
  const [hubReady, setHubReady] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [nhkArticlesByType, setNhkArticlesByType] = useState<{
    easy: NhkArticle[];
    normal: NhkArticle[];
  }>({ easy: [], normal: [] });
  const [nhkReady, setNhkReady] = useState(false);
  const [nhkError, setNhkError] = useState(false);
  const [analytics, setAnalytics] = useState<LearnerAnalytics | null>(null);
  const [analyticsReady, setAnalyticsReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingJustCompleted, setOnboardingJustCompleted] = useState(false);
  const loadData = useCallback(() => {
    setHubReady(false);
    setNhkReady(false);
    setAnalyticsReady(false);

    void learnerApiFetchOptional(
      `/api/daily/home?locale=${locale}${userId ? `&userId=${encodeURIComponent(userId)}` : ""}`
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

    void learnerApiFetchOptional(`/api/nhk-news?type=easy&limit=8&locale=${locale}`)
      .then(async (easyRes) => {
        const easy = easyRes?.ok ? await easyRes.json().catch(() => []) : [];
        setNhkArticlesByType((prev) => ({
          ...prev,
          easy: Array.isArray(easy) ? easy : []
        }));
        setNhkError(!easyRes?.ok);
      })
      .catch(() => {
        setNhkArticlesByType((prev) => ({ ...prev, easy: [] }));
        setNhkError(true);
      })
      .finally(() => setNhkReady(true));

    if (userId) {
      setAnalyticsReady(false);
      void learnerApiFetchOptional(
        `/api/analytics/learner?days=7&userId=${encodeURIComponent(userId)}&locale=${locale}`
      )
        .then(async (r) => {
          if (r?.ok) setAnalytics(await r.json());
          else setAnalytics(null);
        })
        .catch(() => setAnalytics(null))
        .finally(() => setAnalyticsReady(true));
    } else {
      setAnalytics(null);
      setAnalyticsReady(true);
    }
  }, [locale, userId]);

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

  /** Lazy-load a specific news type on demand (e.g. when user switches tab) */
  const loadNewsType = useCallback(
    (type: "easy" | "normal") => {
      if (nhkArticlesByType[type].length > 0) return; // already loaded
      void learnerApiFetchOptional(`/api/nhk-news?type=${type}&limit=8&locale=${locale}`)
        .then(async (res) => {
          const data = res?.ok ? await res.json().catch(() => []) : [];
          setNhkArticlesByType((prev) => ({
            ...prev,
            [type]: Array.isArray(data) ? data : []
          }));
        })
        .catch(() => {});
    },
    [locale, nhkArticlesByType]
  );

  return (
    <main className="min-w-0 space-y-8 overflow-x-clip pb-12 pt-2 sm:space-y-10 sm:pt-6">
      {showOnboarding && (
        <OnboardingFlow
          onComplete={() => {
            setShowOnboarding(false);
            setOnboardingJustCompleted(true);
          }}
        />
      )}
      <PushPromptBanner labels={pushBannerLabels} />

      <div className="hp-enter">
        <TodayPlanHub
          analytics={analytics}
          hub={hub}
          hubError={hubError}
          hubReady={hubReady}
          isOffline={isOffline}
          labels={labels}
          locale={locale}
          onRetry={loadData}
        />
      </div>

      <div className="hp-enter hp-enter-d2 mx-auto w-full max-w-[1280px]">
        <HomepageSectionsTabs
          analytics={analytics}
          analyticsLoading={isLoggedIn && !analyticsReady}
          isLoggedIn={isLoggedIn}
          labels={labels}
          locale={locale}
          nhkArticlesByType={nhkArticlesByType}
          nhkError={nhkError}
          nhkReady={nhkReady}
          onNhkRetry={loadData}
          onNhkTabChange={loadNewsType}
          onboardingJustCompleted={onboardingJustCompleted}
          tabsLabels={labels.tabs}
        />
      </div>

      <div className="mx-auto w-full max-w-[1280px]">
        <AdBanner locale={locale} />
      </div>
    </main>
  );
}
