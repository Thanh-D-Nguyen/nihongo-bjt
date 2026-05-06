"use client";

import Link from "next/link";
import type { HomepageLabels, LearnerAnalytics } from "./types";

function StatCard({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface p-4 shadow-sm ring-1 ring-ink/5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-leaf-soft text-leaf">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-ink">{value}</p>
        <p className="truncate text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

export function ProgressSection({
  analytics,
  analyticsLoading,
  labels,
  locale,
  isLoggedIn,
}: {
  analytics: LearnerAnalytics | null;
  analyticsLoading?: boolean;
  labels: HomepageLabels;
  locale: string;
  isLoggedIn: boolean;
}) {
  if (!isLoggedIn) {
    return (
      <section className="rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm ring-1 ring-ink/5">
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-leaf-soft text-leaf">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-ink">{labels.progressSignIn}</h3>
            <p className="mt-1 text-sm text-muted">{labels.progressSignInSub}</p>
          </div>
          <Link
            href={`/${locale}/login`}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-leaf px-5 text-sm font-bold text-white outline-none ring-offset-2 transition hover:bg-leaf/90 focus-visible:ring-2 focus-visible:ring-accent"
          >
            {labels.progressSignInCta}
          </Link>
        </div>
      </section>
    );
  }

  const totals = analytics?.totals;

  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink sm:text-xl">{labels.progressTitle}</h2>
          <p className="text-sm text-muted">{labels.progressSubtitle}</p>
        </div>
        <Link
          href={`/${locale}/analytics`}
          className="text-sm font-semibold text-accent outline-none hover:text-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {labels.sectionViewAll}
        </Link>
      </div>

      {analyticsLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-busy>
          {[1, 2, 3, 4].map((i) => (
            <div className="h-[4.5rem] animate-pulse rounded-xl bg-paper ring-1 ring-ink/5" key={i} />
          ))}
          <p className="sr-only">{labels.sectionLoadingHint}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label={labels.progressStreakLabel}
            value={totals ? labels.progressStreak.replace("{n}", String(totals.streakDays)) : "—"}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
          <StatCard
            label={labels.progressReviews}
            value={totals ? String(totals.reviewCount) : "—"}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 10h18" />
              </svg>
            }
          />
          <StatCard
            label={labels.progressAccuracy}
            value={totals ? `${totals.bjtAccuracyPct}%` : "—"}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
          <StatCard
            label={labels.progressSessions}
            value={totals ? String(totals.completedBjtSessions) : "—"}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
              </svg>
            }
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
