"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetchOptional } from "../../../../lib/learner-api";
import { HeroSection } from "./hero-section";
import { LoginBonusWidget } from "./login-bonus-widget";
import { StudyGoalWidget } from "./study-goal-widget";
import { QuickActionsStrip } from "./quick-actions-strip";
import type { HomepageLabels, LearnerAnalytics, NhkArticle } from "./types";
import { PushPromptBanner, type PushBannerLabels } from "./push-prompt-banner";
import { CompanionPetWidget } from "./companion-pet-widget";
import { SeasonalEventBanner } from "./seasonal-event-banner";
import { AdBanner } from "./ad-banner";
import { OnboardingFlow } from "./onboarding-flow";
import { HomepageSectionsTabs } from "./homepage-sections-tabs";
import { SidebarGuestCta } from "./sidebar-guest-cta";
import { XpRankWidget } from "./xp-rank-widget";

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
  const displayName = useMemo(() => auth.displayName?.trim() || null, [auth.displayName]);

  const [hub, setHub] = useState<DailyHubPayload | null>(null);
  const [hubReady, setHubReady] = useState(false);
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
        if (r?.ok) setHub(await r.json());
        else setHub(null);
      })
      .catch(() => setHub(null))
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

  const dueCount = hub?.dueReviews ?? 0;

  return (
    <main className="space-y-8 overflow-x-hidden pb-12 pt-2 sm:pt-6">
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
        <HeroSection
          displayName={displayName}
          dueCount={dueCount}
          hubReady={hubReady}
          labels={labels}
          locale={locale}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-8">
          <div className="hp-enter hp-enter-d1">
            <QuickActionsStrip
              dueCount={dueCount}
              hubReady={hubReady}
              labels={labels}
              locale={locale}
            />
          </div>

          <div className="hp-enter hp-enter-d1">
            <SeasonalEventBanner locale={locale} />
          </div>

          <div className="hp-enter hp-enter-d2">
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

          <AdBanner locale={locale} />
        </div>

        {/* Sidebar: 4 widget cốt lõi — always-visible motivation stack */}
        <div className="space-y-6 lg:sticky lg:top-20">
          {isLoggedIn ? (
            <>
              <div className="hp-enter hp-enter-d1">
                <XpRankWidget locale={locale} />
              </div>
              <div className="hp-enter hp-enter-d1">
                <CompanionPetWidget locale={locale} />
              </div>
              <div className="hp-enter hp-enter-d2">
                <StudyGoalWidget locale={locale} />
              </div>
              <div className="hp-enter hp-enter-d2">
                <LoginBonusWidget locale={locale} />
              </div>
            </>
          ) : (
            <div className="hp-enter hp-enter-d1">
              <SidebarGuestCta
                title={labels.sidebarSignIn}
                subtitle={labels.sidebarSignInSub}
                cta={labels.progressSignInCta}
                locale={locale}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
