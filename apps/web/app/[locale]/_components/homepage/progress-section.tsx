"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  LoadingSkeleton,
  SectionHeader,
  StatCard as UiStatCard
} from "@nihongo-bjt/ui";
import { IconAnalytics, IconBattle, IconQuiz, IconReview } from "../../../_components/nav-icons";
import { DarumaMascot, getDarumaState } from "./illustrations/daruma";
import { ToriiGate } from "./illustrations/signin-gate";
import type { HomepageLabels, LearnerAnalytics } from "./types";

export function ProgressSection({
  analytics,
  analyticsLoading,
  labels,
  locale,
  isLoggedIn
}: {
  analytics: LearnerAnalytics | null;
  analyticsLoading?: boolean;
  labels: HomepageLabels;
  locale: string;
  isLoggedIn: boolean;
}) {
  if (!isLoggedIn) {
    return (
      <section>
        <Card className="overflow-hidden">
          <CardContent className="relative space-y-4">
            {/* Torii gate illustration */}
            <ToriiGate className="absolute -right-2 -top-2 h-20 w-20 opacity-[0.15]" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#3B82F6]">
                {labels.progressTitle}
              </p>
              <h2 className="mt-2 text-base font-semibold text-[#111827]">{labels.progressSignIn}</h2>
              <p className="mt-1 text-sm leading-relaxed text-[#4B5563]">{labels.progressSignInSub}</p>
            </div>
            <Link
              href={`/${locale}/login`}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-[10px] bg-[#1B2A4A] px-5 text-sm font-semibold text-white outline-none ring-offset-2 transition-all duration-150 hover:bg-[#243560] focus-visible:ring-2 focus-visible:ring-blue-500/30"
            >
              {labels.progressSignInCta}
            </Link>
          </CardContent>
        </Card>
      </section>
    );
  }

  const totals = analytics?.totals;
  const streakDays = totals?.streakDays ?? 0;
  const allReviewsDone = (totals?.reviewCount ?? 0) > 0 && streakDays >= 7;
  const darumaState = getDarumaState(streakDays, allReviewsDone);

  return (
    <section>
      <SectionHeader
        title={labels.progressTitle}
        description={labels.progressSubtitle}
        actions={
          <Link
            href={`/${locale}/analytics`}
            className="text-sm font-semibold text-[#3B82F6] outline-none hover:text-[#2563EB] focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-2"
          >
            {labels.sectionViewAll}
          </Link>
        }
      />

      {analyticsLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1" aria-busy>
          {[1, 2, 3, 4].map((i) => (
            <LoadingSkeleton className="h-24" key={i} />
          ))}
          <p className="sr-only">{labels.sectionLoadingHint}</p>
        </div>
      ) : (
        <div className="relative">
          {/* Daruma mascot — floats top-right of stats area */}
          <DarumaMascot
            className="absolute -right-1 -top-10 z-10 h-14 w-14 drop-shadow-sm sm:h-16 sm:w-16"
            state={darumaState}
          />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <UiStatCard
              label={labels.progressStreakLabel}
              value={totals ? labels.progressStreak.replace("{n}", String(totals.streakDays)) : "—"}
              hint={<IconBattle aria-hidden size={16} />}
            />
            <UiStatCard
              label={labels.progressReviews}
              value={totals ? String(totals.reviewCount) : "—"}
              hint={<IconReview aria-hidden size={16} />}
            />
            <UiStatCard
              label={labels.progressAccuracy}
              value={totals ? `${totals.bjtAccuracyPct}%` : "—"}
              hint={<IconAnalytics aria-hidden size={16} />}
            />
            <UiStatCard
              label={labels.progressSessions}
              value={totals ? String(totals.completedBjtSessions) : "—"}
              hint={<IconQuiz aria-hidden size={16} />}
            />
          </div>
        </div>
      )}

      {analytics?.insight ? (
        <div className="mt-3 rounded-[10px] border border-amber-200 bg-amber-50 p-4 text-sm text-[#111827]">
          {analytics.insight}
        </div>
      ) : null}

      <div className="mt-3 rounded-[10px] border border-indigo-100 bg-gradient-to-br from-indigo-50 to-slate-50 p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">
          Career RPG
        </p>
        <p className="mt-1 text-sm font-semibold text-[#111827]">{labels.careerRpgTitle}</p>
        <Link
          href={`/${locale}/career`}
          className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-indigo-200 bg-white px-3 text-sm font-semibold text-indigo-700 shadow-sm outline-none transition hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-400/40"
        >
          {labels.careerRpgCta} →
        </Link>
      </div>
    </section>
  );
}
