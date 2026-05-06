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
        <Card>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                {labels.progressTitle}
              </p>
              <h2 className="mt-2 text-base font-semibold text-ink">{labels.progressSignIn}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{labels.progressSignInSub}</p>
            </div>
            <Link
              href={`/${locale}/login`}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-surface outline-none ring-offset-2 transition hover:bg-ink/90 focus-visible:ring-2 focus-visible:ring-accent"
            >
              {labels.progressSignInCta}
            </Link>
          </CardContent>
        </Card>
      </section>
    );
  }

  const totals = analytics?.totals;

  return (
    <section>
      <SectionHeader
        title={labels.progressTitle}
        description={labels.progressSubtitle}
        actions={
          <Link
            href={`/${locale}/analytics`}
            className="text-sm font-semibold text-accent outline-none hover:text-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
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
      )}

      {analytics?.insight ? (
        <div className="mt-3 rounded-xl border border-amber-200/50 bg-amber-soft/40 p-4 text-sm text-ink">
          {analytics.insight}
        </div>
      ) : null}
    </section>
  );
}
