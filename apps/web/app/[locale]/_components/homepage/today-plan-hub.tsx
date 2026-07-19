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
  analyticsError: boolean;
  analyticsReady: boolean;
  hub: DailyHubPayload | null;
  hubError: boolean;
  hubReady: boolean;
  isOffline: boolean;
  labels: HomepageLabels;
  locale: string;
  onRetry: () => void;
};

function formatDate(locale: string, dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date =
    Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)
      ? new Date(year, month - 1, day)
      : new Date();

  return date.toLocaleDateString(toIntlLocale(locale), {
    day: "numeric",
    month: "long",
    weekday: "long"
  });
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 20 20">
      <path
        d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function SkeletonLine({ className }: { className?: string }) {
  return <span className={cn("block animate-pulse rounded-full bg-border", className)} />;
}

function ActionCard({
  accentClassName,
  description,
  href,
  title
}: {
  accentClassName: string;
  description: string;
  href: string;
  title: string;
}) {
  return (
    <Link
      className="group flex min-h-[92px] items-center gap-4 rounded-xl bg-surface p-4 text-ink shadow-sm ring-1 ring-border transition-[transform,box-shadow] duration-300 ease-[var(--ease-spring)] hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus active:translate-y-0 sm:p-5"
      href={href}
    >
      <span aria-hidden="true" className={cn("h-10 w-1 shrink-0 rounded-full", accentClassName)} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold leading-snug sm:text-[15px]">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted">{description}</span>
      </span>
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-paper text-muted transition-transform duration-300 ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:text-ink"
      >
        <ArrowIcon className="size-4" />
      </span>
    </Link>
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
    empty: "bg-surface text-ink ring-border",
    error: "bg-danger-soft text-danger ring-danger/25",
    offline: "bg-warning-soft text-warning ring-warning/25"
  }[tone];

  return (
    <div className={cn("rounded-lg px-4 py-3 text-sm font-semibold ring-1", toneClass)}>
      <span>{title}</span>
      {href && action ? (
        <Link className="ml-1 underline decoration-current/40 underline-offset-4" href={href}>
          {action}
        </Link>
      ) : null}
    </div>
  );
}

function SnapshotRow({
  children,
  className,
  label
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div className={cn("px-5 py-5 sm:px-6", className)}>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      {children}
    </div>
  );
}

export function TodayPlanHub({
  analytics,
  analyticsError,
  analyticsReady,
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
  const hasBjtSessions = Boolean(analytics?.totals.completedBjtSessions);
  const readiness = analyticsError
    ? copy.analyticsUnavailable
    : hasBjtSessions
      ? `${Math.round(analytics?.totals.bjtAccuracyPct ?? 0)}%`
      : copy.readinessUnavailable;
  const streak = analytics?.totals.streakDays ?? 0;

  if (!hubReady) {
    return (
      <section
        aria-busy="true"
        aria-labelledby="today-plan-heading"
        className="mx-auto w-full max-w-[1280px]"
      >
        <h1 className="sr-only" id="today-plan-heading">
          {copy.title}
        </h1>
        <div className="mb-6 space-y-3">
          <SkeletonLine className="h-3 w-36" />
          <SkeletonLine className="h-9 w-64 max-w-full" />
          <SkeletonLine className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)] lg:gap-5">
          <div className="space-y-4">
            <div className="rounded-xl bg-border p-1">
              <div className="h-[238px] animate-pulse rounded-[calc(var(--radius-xl)-4px)] bg-surface" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-[92px] animate-pulse rounded-xl bg-surface shadow-sm ring-1 ring-border" />
              <div className="h-[92px] animate-pulse rounded-xl bg-surface shadow-sm ring-1 ring-border" />
            </div>
          </div>
          <div className="h-[374px] animate-pulse rounded-xl bg-surface shadow-sm ring-1 ring-border" />
        </div>
        <p className="sr-only">{labels.sectionLoadingHint}</p>
      </section>
    );
  }

  if (hubError && !hub) {
    return (
      <section className="mx-auto w-full max-w-[1280px]" aria-labelledby="today-plan-heading">
        <h1 className="sr-only" id="today-plan-heading">
          {copy.title}
        </h1>
        <HomeStateCard title={copy.errorTitle} tone="error" />
        <button
          className="mt-3 min-h-11 rounded-md bg-surface px-4 text-sm font-semibold text-ink shadow-sm ring-1 ring-border transition-transform duration-200 ease-[var(--ease-spring)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus active:translate-y-0"
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
      <section className="mx-auto w-full max-w-[1280px]" aria-labelledby="today-plan-heading">
        <h1 className="sr-only" id="today-plan-heading">
          {copy.title}
        </h1>
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
    <section className="mx-auto w-full max-w-[1280px]" aria-labelledby="today-plan-heading">
      <header className="mb-6 sm:flex sm:items-end sm:justify-between sm:gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            {copy.dateLabel.replace("{date}", formatDate(locale, hub.today))}
          </p>
          <h1
            className="mt-2 text-[1.75rem] font-bold leading-tight text-ink sm:text-3xl"
            id="today-plan-heading"
          >
            {copy.title}
          </h1>
        </div>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:mt-0 sm:text-right">
          {copy.meta}
        </p>
      </header>

      {isOffline ? <HomeStateCard title={copy.offlineTitle} tone="offline" /> : null}

      <div
        className={cn(
          "grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)] lg:gap-5",
          isOffline && "mt-4"
        )}
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-border p-1 shadow-sm">
            <article className="relative overflow-hidden rounded-[calc(var(--radius-xl)-4px)] bg-[var(--color-brand-panel)] px-5 py-6 text-white sm:px-8 sm:py-8">
              <div
                aria-hidden="true"
                className="absolute -right-16 -top-20 size-56 rounded-full border border-white/10"
              />
              <div
                aria-hidden="true"
                className="absolute -right-6 -top-8 size-32 rounded-full border border-white/10"
              />
              <div className="relative max-w-2xl">
                <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-100 ring-1 ring-white/15">
                  {copy.primaryEyebrow}
                </span>
                <h2 className="mt-5 text-xl font-bold leading-snug sm:text-2xl">
                  {copy.primaryTitle}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-100/80">
                  {copy.primarySub}
                </p>
                <Link
                  className="group mt-7 inline-flex min-h-12 items-center gap-3 rounded-full bg-white py-1.5 pl-5 pr-1.5 text-sm font-bold text-[#1B2A4A] shadow-[0_8px_24px_rgba(4,11,27,0.18)] transition-[transform,box-shadow] duration-300 ease-[var(--ease-spring)] hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(4,11,27,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1B2A4A] active:translate-y-0"
                  href={`/${locale}/levels`}
                >
                  {copy.primaryCta}
                  <span className="grid size-9 place-items-center rounded-full bg-[#1B2A4A] text-white transition-transform duration-300 ease-[var(--ease-spring)] group-hover:translate-x-0.5">
                    <ArrowIcon className="size-4" />
                  </span>
                </Link>
              </div>
            </article>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ActionCard
              accentClassName="bg-srs-review"
              description={(dueCount > 0 ? copy.reviewSubWithCount : copy.reviewSub).replace(
                "{count}",
                String(dueCount)
              )}
              href={`/${locale}/flashcards`}
              title={
                dueCount > 0
                  ? copy.reviewTitle.replace("{count}", String(dueCount))
                  : copy.reviewEmptyTitle
              }
            />
            <ActionCard
              accentClassName="bg-warning"
              description={copy.remediationSub}
              href={`/${locale}/review-inbox-preview`}
              title={copy.remediationTitle}
            />
          </div>
        </div>

        <aside
          className="overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-border"
          aria-label={copy.snapshotLabel}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
            <p className="text-sm font-bold text-ink">{copy.snapshotLabel}</p>
            <span
              className="size-2 rounded-full bg-success ring-4 ring-success-soft"
              aria-hidden="true"
            />
          </div>

          <SnapshotRow label={copy.readinessLabel}>
            <div className="mt-2 flex items-end justify-between gap-3">
              {analyticsReady ? (
                <p
                  className={cn(
                    "font-bold tabular-nums text-brand-navy",
                    hasBjtSessions && !analyticsError ? "text-3xl" : "text-lg leading-snug"
                  )}
                >
                  {readiness}
                </p>
              ) : (
                <SkeletonLine className="h-8 w-32" />
              )}
              <span className="mb-0.5 shrink-0 rounded-full bg-brand-sky px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-navy ring-1 ring-accent/15">
                {copy.estimatedBadge}
              </span>
            </div>
          </SnapshotRow>

          <SnapshotRow className="border-t border-border" label={copy.dailyPhraseLabel}>
            <p className="jp-text mt-3 text-[1.65rem] font-bold leading-[1.9] text-ink" lang="ja">
              <ruby>
                {hub.greeting.japanese}
                {hub.greeting.reading ? (
                  <rt className="font-normal text-muted">{hub.greeting.reading}</rt>
                ) : null}
              </ruby>
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">{copy.dailyPhraseMeaning}</p>
          </SnapshotRow>

          <SnapshotRow className="border-t border-border" label={copy.streakLabel}>
            <div className="mt-2 flex items-baseline gap-2">
              {analyticsReady ? (
                <span className="text-3xl font-bold tabular-nums text-ink">
                  {analyticsError ? "—" : streak}
                </span>
              ) : (
                <SkeletonLine className="h-8 w-12" />
              )}
              <span className="text-sm font-medium text-muted">{copy.streakUnit}</span>
            </div>
          </SnapshotRow>
        </aside>
      </div>
    </section>
  );
}
