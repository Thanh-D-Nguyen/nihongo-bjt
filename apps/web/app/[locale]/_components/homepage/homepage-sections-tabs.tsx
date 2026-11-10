"use client";

import { useEffect, useState } from "react";
import { TabButton, TabsList } from "@nihongo-bjt/ui";
import Link from "next/link";

import { ForYouFeedWidget } from "./for-you-feed-widget";
import { DailyRadarSection } from "@/src/features/daily-radar/daily-radar-section";
import { FeaturedNewsSection } from "./featured-news-section";
import { LearningHeatmap } from "./learning-heatmap";
import { BjtLevelsSection } from "./bjt-levels-section";
import { ProgressSection } from "./progress-section";
import { WeeklyReportCard } from "./weekly-report-card";
import { MysteryBoxWidget } from "./mystery-box-widget";
import { RevengeModeWidget } from "./revenge-mode-widget";
import { FocusTimerWidget } from "./focus-timer-widget";
import { AmbientModeWidget } from "./ambient-mode-widget";
import { LotoTeaserWidget } from "./loto-teaser-widget";
import { StudyGoalWidget } from "./study-goal-widget";
import type { HomepageLabels, LearnerAnalytics, NewsType, NhkArticle } from "./types";

export type HomepageTabKey = "today" | "progress" | "rewards" | "focus";

export interface HomepageTabsLabels {
  today: string;
  progress: string;
  rewards: string;
  focus: string;
  todaySub: string;
  progressSub: string;
  rewardsSub: string;
  focusSub: string;
}

const STORAGE_KEY = "nihongo-homepage-tab";

const TAB_ORDER: HomepageTabKey[] = ["today", "progress", "rewards", "focus"];

function readStoredTab(): HomepageTabKey {
  if (typeof window === "undefined") return "today";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && (TAB_ORDER as string[]).includes(raw)) return raw as HomepageTabKey;
  } catch {
    // ignore storage errors (SSR / private mode)
  }
  return "today";
}

export function HomepageSectionsTabs({
  labels,
  tabsLabels,
  locale,
  isLoggedIn,
  analytics,
  analyticsLoading,
  nhkArticlesByType,
  nhkReady,
  nhkError,
  onNhkRetry,
  onNhkTabChange,
  onboardingJustCompleted,
}: {
  labels: HomepageLabels;
  tabsLabels: HomepageTabsLabels;
  locale: string;
  isLoggedIn: boolean;
  analytics: LearnerAnalytics | null;
  analyticsLoading: boolean;
  nhkArticlesByType: Partial<Record<NewsType, NhkArticle[]>> & { easy: NhkArticle[]; normal: NhkArticle[] };
  nhkReady: boolean;
  nhkError: boolean;
  onNhkRetry: () => void;
  onNhkTabChange: (type: NewsType) => void;
  onboardingJustCompleted: boolean;
}) {
  const [active, setActive] = useState<HomepageTabKey>("today");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setActive(readStoredTab());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, active);
    } catch {
      // ignore
    }
  }, [active, hydrated]);

  const tabs: { key: HomepageTabKey; label: string; sub: string }[] = [
    { key: "today", label: tabsLabels.today, sub: tabsLabels.todaySub },
    { key: "progress", label: tabsLabels.progress, sub: tabsLabels.progressSub },
    { key: "rewards", label: tabsLabels.rewards, sub: tabsLabels.rewardsSub },
    { key: "focus", label: tabsLabels.focus, sub: tabsLabels.focusSub }
  ];

  return (
    <section aria-label="Homepage sections" className="min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList
          aria-label="Homepage tabs"
          className="flex w-full snap-x snap-mandatory overflow-x-auto scrollbar-none sm:w-auto"
        >
          {tabs.map((t) => (
            <TabButton
              key={t.key}
              active={active === t.key}
              aria-controls={`homepage-tab-panel-${t.key}`}
              id={`homepage-tab-${t.key}`}
              onClick={() => setActive(t.key)}
              className="min-h-11 min-w-fit snap-start whitespace-nowrap px-4"
            >
              {t.label}
            </TabButton>
          ))}
        </TabsList>
        <p className="hidden text-xs text-muted sm:block">
          {tabs.find((t) => t.key === active)?.sub}
        </p>
      </div>

      {/* "Hôm nay" — Today */}
      {active === "today" && (
        <div
          key="tab-today"
          aria-labelledby="homepage-tab-today"
          className="hp-tab-enter space-y-8"
          id="homepage-tab-panel-today"
          role="tabpanel"
        >
          <StudyGoalWidget locale={locale} />
          <ForYouFeedWidget locale={locale} refreshKey={onboardingJustCompleted ? 1 : 0} />
          <DailyRadarSection labels={labels.dailyRadar} locale={locale} />
          <FeaturedNewsSection
            articlesByType={nhkArticlesByType}
            error={nhkError}
            labels={labels}
            loading={!nhkReady}
            locale={locale}
            onRetry={onNhkRetry}
            onTabChange={onNhkTabChange}
          />
          <LotoTeaserWidget locale={locale} />
        </div>
      )}

      {/* "Tiến độ" — Progress */}
      {active === "progress" && (
        <div
          key="tab-progress"
          aria-labelledby="homepage-tab-progress"
          className="hp-tab-enter space-y-8"
          id="homepage-tab-panel-progress"
          role="tabpanel"
        >
          <LearningHeatmap />
          <BjtLevelsSection labels={labels.bjtLevels} locale={locale} />
          <ProgressSection
            analytics={analytics}
            analyticsLoading={analyticsLoading}
            isLoggedIn={isLoggedIn}
            labels={labels}
            locale={locale}
          />
          <WeeklyReportCard locale={locale} />
        </div>
      )}

      {/* "Phần thưởng" — Rewards */}
      {active === "rewards" && (
        <div
          key="tab-rewards"
          aria-labelledby="homepage-tab-rewards"
          className="hp-tab-enter space-y-8"
          id="homepage-tab-panel-rewards"
          role="tabpanel"
        >
          {isLoggedIn ? (
            <>
              <MysteryBoxWidget locale={locale} />
              <RevengeModeWidget locale={locale} />
            </>
          ) : (
            <GuestRewardsCta
              title={labels.rewardsSignIn}
              subtitle={labels.rewardsSignInSub}
              cta={labels.rewardsSignInCta}
              locale={locale}
            />
          )}
        </div>
      )}

      {/* "Tập trung" — Focus */}
      {active === "focus" && (
        <div
          key="tab-focus"
          aria-labelledby="homepage-tab-focus"
          className="hp-tab-enter space-y-8"
          id="homepage-tab-panel-focus"
          role="tabpanel"
        >
          <FocusTimerWidget isLoggedIn={isLoggedIn} locale={locale} signInLabel={labels.rewardsSignInCta} />
          <AmbientModeWidget />
        </div>
      )}
    </section>
  );
}

function GuestRewardsCta({ title, subtitle, cta, locale }: { title: string; subtitle: string; cta: string; locale: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-8 text-center shadow-xs">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-accent/10 text-accent" aria-hidden>
        <svg className="size-6" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="max-w-xs text-sm text-muted">{subtitle}</p>
      <Link
        href={`/${locale}/login`}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1B2A4A] px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#243560]"
      >
        {cta}
      </Link>
    </div>
  );
}
