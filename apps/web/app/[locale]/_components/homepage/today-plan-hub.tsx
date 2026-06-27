"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@nihongo-bjt/ui";
import { toIntlLocale } from "@/lib/locale-utils";

import type { HomepageLabels, LearnerAnalytics } from "./types";

type DailyHubPayload = {
  dueReviews: number;
  greeting: { japanese: string; reading: string };
  today: string;
};

type TodayPlanHubProps = {
  analytics: LearnerAnalytics | null;
  hub: DailyHubPayload | null;
  hubError: boolean;
  hubReady: boolean;
  isOffline: boolean;
  labels: HomepageLabels;
  locale: string;
  onRetry: () => void;
};

function formatDate(locale: string) {
  return new Date().toLocaleDateString(toIntlLocale(locale), {
    day: "numeric",
    month: "long",
    weekday: "long"
  });
}

function SkeletonLine({ className }: { className?: string }) {
  return <span className={cn("block animate-pulse rounded-full bg-slate-200", className)} />;
}

function TimelineDot({ active, children }: { active?: boolean; children?: ReactNode }) {
  return (
    <span
      className={cn(
        "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold tabular-nums",
        active
          ? "border-[#1B2A4A] bg-[#1B2A4A] text-white"
          : "border-[#CBD5E1] bg-[#F8FAFC] text-[#4B5563]"
      )}
    >
      {children}
    </span>
  );
}

function SupportCard({
  children,
  className,
  label
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <article
      aria-label={label}
      className={cn(
        "rounded-[14px] border border-[#E2E8F0] bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)]",
        className
      )}
    >
      {children}
    </article>
  );
}

function HomeStateCard({
  action,
  href,
  tone,
  title
}: {
  action?: string;
  href?: string;
  title: string;
  tone: "empty" | "error" | "offline";
}) {
  const toneClass = {
    empty: "border-[#E2E8F0] bg-white text-[#111827]",
    error: "border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]",
    offline: "border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]"
  }[tone];

  return (
    <div className={cn("rounded-[14px] border px-4 py-3 text-sm font-semibold", toneClass)}>
      <span>{title}</span>
      {href && action ? (
        <Link className="ml-1 underline underline-offset-4" href={href}>
          {action}
        </Link>
      ) : null}
    </div>
  );
}

export function TodayPlanHub({
  analytics,
  hub,
  hubError,
  hubReady,
  isOffline,
  labels,
  locale,
  onRetry
}: TodayPlanHubProps) {
  const copy = labels.todayPlan;
  const dueCount = hub?.dueReviews ?? 0;
  const readiness = analytics?.totals.completedBjtSessions
    ? `${Math.round(analytics.totals.bjtAccuracyPct)}%`
    : copy.readinessUnavailable;
  const streak = analytics?.totals.streakDays ?? 0;

  if (!hubReady) {
    return (
      <section
        aria-busy="true"
        aria-labelledby="today-plan-heading"
        className="mx-auto max-w-[1280px]"
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            <SkeletonLine className="h-4 w-40" />
            <SkeletonLine className="h-9 w-72 max-w-full" />
            <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-5">
              <SkeletonLine className="h-4 w-28" />
              <SkeletonLine className="mt-3 h-6 w-64 max-w-full" />
              <SkeletonLine className="mt-3 h-4 w-40" />
            </div>
            <SkeletonLine className="h-12 w-full" />
            <SkeletonLine className="h-12 w-full" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <SkeletonLine className="h-24 w-full rounded-[14px]" />
            <SkeletonLine className="h-24 w-full rounded-[14px]" />
            <SkeletonLine className="h-16 w-full rounded-[14px] sm:col-span-2 lg:col-span-1" />
          </div>
        </div>
        <p className="sr-only">{labels.sectionLoadingHint}</p>
      </section>
    );
  }

  if (hubError && !hub) {
    return (
      <section className="mx-auto max-w-[1280px]" aria-labelledby="today-plan-heading">
        <HomeStateCard action={copy.errorCta} title={copy.errorTitle} tone="error" />
        <button
          className="mt-3 rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-semibold text-[#111827] shadow-sm"
          type="button"
          onClick={onRetry}
        >
          {copy.errorCta}
        </button>
      </section>
    );
  }

  if (!hub) {
    return (
      <section className="mx-auto max-w-[1280px]" aria-labelledby="today-plan-heading">
        <HomeStateCard
          action={copy.emptyCta}
          href={`/${locale}/onboarding`}
          title={copy.emptyTitle}
          tone="empty"
        />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1280px]" aria-labelledby="today-plan-heading">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#4B5563]">
                {copy.dateLabel.replace("{date}", formatDate(locale))}
              </p>
              <h1
                className="mt-1 text-[1.7rem] font-bold leading-tight text-[#111827] sm:text-3xl"
                id="today-plan-heading"
              >
                {copy.title}
              </h1>
              <p className="mt-1 text-sm text-[#4B5563]">{copy.meta}</p>
            </div>
            <div className="hidden rounded-full border border-[#FCD34D] bg-[#FFFBEB] px-4 py-2 text-sm font-bold tabular-nums text-[#92400E] sm:block">
              {streak} <span className="text-xs font-semibold">{copy.streakLabel}</span>
            </div>
          </div>

          {isOffline ? <HomeStateCard title={copy.offlineTitle} tone="offline" /> : null}

          <ol className="relative mt-4 space-y-3" aria-label={copy.title}>
            <span aria-hidden="true" className="absolute bottom-7 left-3 top-3 w-px bg-[#E2E8F0]" />
            <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-4">
              <TimelineDot active>1</TimelineDot>
              <div className="rounded-[14px] bg-[#1B2A4A] px-5 py-4 text-white shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#DBEAFE]">
                    {copy.primaryEyebrow}
                  </p>
                  <h2 className="mt-1 text-base font-bold leading-snug sm:text-lg">
                    {copy.primaryTitle}
                  </h2>
                  <p className="mt-1 text-sm text-white/70">{copy.primarySub}</p>
                </div>
                <Link
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[10px] bg-white px-5 text-sm font-bold text-[#1B2A4A] shadow-sm transition active:scale-[0.98] sm:mt-0"
                  href={`/${locale}/levels`}
                >
                  {copy.primaryCta}
                </Link>
              </div>
            </li>

            <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-4">
              <TimelineDot />
              <Link
                className="group flex min-h-14 items-center justify-between rounded-[14px] border border-[#E2E8F0] bg-white px-5 py-3 text-[#111827] shadow-sm transition hover:border-[#CBD5E1] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
                href={`/${locale}/flashcards`}
              >
                <span>
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <span aria-hidden="true" className="size-2 rounded-full bg-[#3B82F6]" />
                    {copy.reviewTitle.replace("{count}", String(dueCount))}
                  </span>
                  <span className="mt-0.5 block text-xs text-[#4B5563]">
                    {(dueCount > 0 ? copy.reviewSubWithCount : copy.reviewSub).replace(
                      "{count}",
                      String(dueCount)
                    )}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-[#9CA3AF] transition group-hover:translate-x-0.5"
                >
                  ›
                </span>
              </Link>
            </li>

            <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-4">
              <TimelineDot />
              <Link
                className="group flex min-h-14 items-center justify-between rounded-[14px] border border-[#E2E8F0] bg-white px-5 py-3 text-[#111827] shadow-sm transition hover:border-[#CBD5E1] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
                href={`/${locale}/review-inbox-preview`}
              >
                <span>
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <span aria-hidden="true" className="size-2 rounded-full bg-[#D97706]" />
                    {copy.remediationTitle}
                  </span>
                  <span className="mt-0.5 block text-xs text-[#4B5563]">{copy.remediationSub}</span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-[#9CA3AF] transition group-hover:translate-x-0.5"
                >
                  ›
                </span>
              </Link>
            </li>
          </ol>
        </div>

        <aside
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1"
          aria-label={copy.readinessLabel}
        >
          <SupportCard label={copy.readinessLabel}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#4B5563]">
                {copy.readinessLabel}
              </p>
              <span className="rounded-full border border-[#FCD34D] bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-bold text-[#92400E]">
                {copy.estimatedBadge}
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums text-[#1B2A4A]">{readiness}</p>
          </SupportCard>

          <SupportCard label={copy.dailyPhraseLabel}>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">
              {copy.dailyPhraseLabel}
            </p>
            <p className="jp-text mt-2 text-xl font-bold text-[#111827]" lang="ja">
              <ruby>
                {hub.greeting.japanese}
                {hub.greeting.reading ? <rt>{hub.greeting.reading}</rt> : null}
              </ruby>
            </p>
            <p className="mt-2 text-sm text-[#4B5563]">{copy.dailyPhraseMeaning}</p>
          </SupportCard>

          <SupportCard className="sm:col-span-2 lg:col-span-1" label={copy.streakLabel}>
            <p className="text-sm font-semibold text-[#4B5563]">{copy.streakLabel}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#1B2A4A]">{streak}</p>
          </SupportCard>
        </aside>
      </div>
    </section>
  );
}
