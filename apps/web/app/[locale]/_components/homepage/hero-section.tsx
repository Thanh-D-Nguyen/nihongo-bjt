"use client";

import Link from "next/link";
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
  dueCount,
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
  const secondaryLabel = primaryIsReview ? labels.cockpitSecondaryToQuiz : labels.cockpitSecondaryToFlashcards;

  if (!hubReady) {
    return (
      <section className="rounded-2xl border border-ink/10 bg-surface px-5 py-6 shadow-sm sm:px-8 sm:py-8" aria-busy>
        <div className="h-4 w-24 animate-pulse rounded bg-paper" />
        <div className="mt-4 h-8 max-w-md animate-pulse rounded bg-paper" />
        <div className="mt-3 h-4 max-w-lg animate-pulse rounded bg-paper" />
        <div className="mt-6 flex flex-wrap gap-3">
          <div className="h-11 w-40 animate-pulse rounded-full bg-paper" />
          <div className="h-11 w-28 animate-pulse rounded-full bg-paper" />
        </div>
        <p className="sr-only">{labels.sectionLoadingHint}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-ink/10 bg-surface px-5 py-6 shadow-sm sm:px-8 sm:py-8">
      <p className="text-[11px] font-bold uppercase tracking-wide text-leaf">{labels.cockpitEyebrow}</p>
      <p className="mt-2 text-sm text-muted">
        {new Date().toLocaleDateString(locale === "ja" ? "ja-JP" : "vi-VN", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </p>
      <h2 className="mt-1 text-xl font-bold tracking-tight text-ink sm:text-2xl">{greeting}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">{primaryLine}</p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-leaf px-6 text-sm font-bold text-white shadow-sm outline-none ring-offset-2 transition hover:bg-leaf/90 focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.99]"
          href={primaryHref}
        >
          {primaryCta}
        </Link>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/15 bg-paper px-5 text-sm font-bold text-ink outline-none ring-offset-2 transition hover:border-ink/25 hover:bg-white focus-visible:ring-2 focus-visible:ring-accent"
          href={secondaryHref}
        >
          {secondaryLabel}
        </Link>
      </div>
    </section>
  );
}
