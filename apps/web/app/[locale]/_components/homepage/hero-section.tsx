"use client";

import Link from "next/link";
import { Card, CardContent, LoadingSkeleton } from "@nihongo-bjt/ui";
import type { HomepageLabels } from "./types";

function getTimeOfDay(labels: HomepageLabels): string {
  const hour = new Date().getHours();
  if (hour < 12) return labels.morningGreeting;
  if (hour < 18) return labels.afternoonGreeting;
  return labels.eveningGreeting;
}

export function HeroSection({
  displayName,
  hubReady,
  labels,
  locale,
  dueCount
}: {
  displayName: string | null;
  hubReady: boolean;
  labels: HomepageLabels;
  locale: string;
  dueCount: number;
}) {
  const timeOfDay = getTimeOfDay(labels);
  const safeName = displayName?.trim() ?? "";
  const greeting =
    safeName.length > 0
      ? labels.heroGreetingNamed.replace("{timeOfDay}", timeOfDay).replace("{name}", safeName)
      : labels.heroGreeting.replace("{timeOfDay}", timeOfDay);

  const primaryIsReview = dueCount > 0;
  const primaryLine = primaryIsReview
    ? labels.cockpitPrimaryDue.replace("{count}", String(dueCount))
    : labels.cockpitPrimaryCalm;
  const primaryHref = primaryIsReview ? `/${locale}/flashcards` : `/${locale}/quiz`;
  const primaryCta = primaryIsReview ? labels.cockpitCtaReviewNow : labels.cockpitCtaQuizPrimary;
  const secondaryHref = primaryIsReview ? `/${locale}/quiz` : `/${locale}/flashcards`;
  const secondaryLabel = primaryIsReview
    ? labels.cockpitSecondaryToQuiz
    : labels.cockpitSecondaryToFlashcards;

  if (!hubReady) {
    return (
      <section aria-busy>
        <Card className="overflow-hidden">
          <CardContent className="grid gap-5 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div>
              <LoadingSkeleton className="h-4 w-24" />
              <LoadingSkeleton className="mt-4 h-8 max-w-md" />
              <LoadingSkeleton className="mt-3 h-4 max-w-lg" />
              <div className="mt-6 flex flex-wrap gap-3">
                <LoadingSkeleton className="h-11 w-40 rounded-full" />
                <LoadingSkeleton className="h-11 w-28 rounded-full" />
              </div>
            </div>
            <LoadingSkeleton className="hidden min-h-36 lg:block" />
          </CardContent>
        </Card>
        <p className="sr-only">{labels.sectionLoadingHint}</p>
      </section>
    );
  }

  return (
    <section>
      <Card className="overflow-hidden">
        <CardContent className="grid gap-6 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
              {labels.cockpitEyebrow}
            </p>
            <p className="mt-2 text-sm text-muted">
              {new Date().toLocaleDateString(locale === "ja" ? "ja-JP" : "vi-VN", {
                weekday: "long",
                month: "long",
                day: "numeric"
              })}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {greeting}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
              {primaryLine}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-surface shadow-sm outline-none ring-offset-2 transition hover:bg-ink/90 focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.99]"
                href={primaryHref}
              >
                {primaryCta}
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-ink/15 bg-surface px-5 text-sm font-semibold text-ink outline-none ring-offset-2 transition hover:border-accent/30 hover:bg-accent/5 focus-visible:ring-2 focus-visible:ring-accent"
                href={secondaryHref}
              >
                {secondaryLabel}
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-ink/10 bg-paper/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              {labels.quickBjt}
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-ink">{dueCount}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {labels.quickFlashcardsSub.replace("{count}", String(dueCount))}
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink/8">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${Math.min(100, Math.max(12, dueCount * 8))}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
