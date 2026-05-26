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
import type { HomepageLabels, LearnerAnalytics, NhkArticle } from "./types";

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
  nhkArticlesByType: { easy: NhkArticle[]; normal: NhkArticle[] };
  nhkReady: boolean;
  nhkError: boolean;
  onNhkRetry: () => void;
  onNhkTabChange: (type: "easy" | "normal") => void;
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

  const tabs: { key: HomepageTabKey; label: string; emoji: string; sub: string }[] = [
    { key: "today", label: tabsLabels.today, emoji: "🔥", sub: tabsLabels.todaySub },
    { key: "progress", label: tabsLabels.progress, emoji: "📊", sub: tabsLabels.progressSub },
    { key: "rewards", label: tabsLabels.rewards, emoji: "🎁", sub: tabsLabels.rewardsSub },
    { key: "focus", label: tabsLabels.focus, emoji: "🧘", sub: tabsLabels.focusSub }
  ];

  return (
    <section aria-label="Homepage sections" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList
          aria-label="Homepage tabs"
          className="flex w-full overflow-x-auto sm:w-auto"
        >
          {tabs.map((t) => (
            <TabButton
              key={t.key}
              active={active === t.key}
              aria-controls={`homepage-tab-panel-${t.key}`}
              id={`homepage-tab-${t.key}`}
              onClick={() => setActive(t.key)}
              className="min-w-fit whitespace-nowrap px-3.5"
            >
              <span aria-hidden className="mr-1.5">{t.emoji}</span>
              {t.label}
            </TabButton>
          ))}
        </TabsList>
        <p className="hidden text-xs text-[#6B7280] sm:block">
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
          <LearningHeatmap locale={locale} />
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
          <FocusTimerWidget locale={locale} />
          <AmbientModeWidget />
        </div>
      )}
    </section>
  );
}

function GuestRewardsCta({ title, subtitle, cta, locale }: { title: string; subtitle: string; cta: string; locale: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-ink/8 bg-surface p-8 text-center shadow-sm">
      <span className="text-4xl" aria-hidden>🎁</span>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="max-w-xs text-sm text-muted">{subtitle}</p>
      <Link
        href={`/${locale}/login`}
        className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-sakura)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:brightness-110 active:scale-95"
      >
        {cta}
      </Link>
    </div>
  );
}
