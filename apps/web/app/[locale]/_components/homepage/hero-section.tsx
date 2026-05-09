"use client";

import Link from "next/link";
import { Card, CardContent, LoadingSkeleton } from "@nihongo-bjt/ui";
import { useEffect, useRef } from "react";
import type { HomepageLabels } from "./types";
import { getCurrentSeason, getSeasonTheme } from "./seasonal";
import { HeroCitySilhouette } from "./illustrations/hero-city";
import { SeasonalOverlay } from "./illustrations/seasonal-elements";

function getTimeOfDay(labels: HomepageLabels): string {
  const hour = new Date().getHours();
  if (hour < 12) return labels.morningGreeting;
  if (hour < 18) return labels.afternoonGreeting;
  return labels.eveningGreeting;
}

/** Lightweight parallax — sets --hero-scroll CSS var based on scroll position. */
function useHeroParallax() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, -rect.top / (rect.height + 200)));
        el.style.setProperty("--hero-scroll", String(progress));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return ref;
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

  const season = getCurrentSeason();
  const theme = getSeasonTheme();
  const heroRef = useHeroParallax();

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
      <div
        ref={heroRef}
        className="relative overflow-hidden rounded-[14px] bg-gradient-to-br from-[#1B2A4A] via-[#1E3A5F] to-[#2563EB] shadow-[0_10px_40px_-8px_rgba(27,42,74,0.35)]"
        style={{ ["--hero-scroll" as string]: "0" }}
      >
        {/* Layered decorative background */}
        <div className="pointer-events-none absolute inset-0">
          {/* Radial glow behind text */}
          <div className="absolute left-[10%] top-[20%] h-80 w-80 rounded-full bg-blue-500/[0.12] blur-3xl" />
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/[0.04] blur-2xl" />
          <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-blue-400/[0.07] blur-3xl" />
          <div className="absolute right-20 top-12 h-24 w-24 rounded-full bg-amber-300/[0.08] blur-2xl" />

          {/* Seasonal overlay tint */}
          <div className="absolute inset-0" style={{ background: theme.heroTint }} />

          {/* Seasonal decorative elements */}
          <SeasonalOverlay className="opacity-70" season={season} />

          {/* City silhouette — parallax */}
          <HeroCitySilhouette
            className="absolute -bottom-2 right-0 hidden w-[60%] max-w-[480px] text-white motion-safe:translate-y-[calc(var(--hero-scroll)*-30px)] lg:block"
          />
          {/* Mobile: smaller city */}
          <HeroCitySilhouette
            className="absolute -bottom-1 right-0 w-[90%] text-white lg:hidden"
            style={{ opacity: 0.5 }}
          />
        </div>

        <div className="relative grid gap-6 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-200/90">
              {labels.cockpitEyebrow}
            </p>
            <p className="mt-2 text-sm text-blue-100/70">
              {new Date().toLocaleDateString(locale === "ja" ? "ja-JP" : "vi-VN", {
                weekday: "long",
                month: "long",
                day: "numeric"
              })}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.15)] sm:text-3xl">
              {greeting}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-blue-100/90 sm:text-base">
              {primaryLine}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-white px-6 text-sm font-semibold text-[#1B2A4A] shadow-[0_4px_20px_rgba(255,255,255,0.2)] outline-none ring-offset-2 transition-all duration-150 hover:bg-blue-50 hover:shadow-[0_6px_28px_rgba(255,255,255,0.3)] focus-visible:ring-2 focus-visible:ring-white/50 active:scale-[0.97]"
                href={primaryHref}
              >
                {primaryCta}
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-white/20 bg-white/[0.08] px-6 text-sm font-semibold text-white shadow-sm outline-none ring-offset-2 backdrop-blur-sm transition-all duration-150 hover:border-white/35 hover:bg-white/[0.14] focus-visible:ring-2 focus-visible:ring-white/50"
                href={secondaryHref}
              >
                {secondaryLabel}
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-amber-300/30 bg-amber-400/[0.12] px-5 text-sm font-semibold text-amber-100 shadow-sm outline-none ring-offset-2 backdrop-blur-sm transition-all duration-150 hover:border-amber-300/50 hover:bg-amber-400/[0.2] focus-visible:ring-2 focus-visible:ring-white/50"
                href={`/${locale}/daily-standup`}
              >
                {labels.cockpitTertiaryToStandup}
              </Link>
            </div>
          </div>

          {/* Stats card — glassmorphism */}
          <div className="rounded-[12px] border border-white/[0.12] bg-white/[0.08] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-200">
              {labels.quickBjt}
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">{dueCount}</p>
            <p className="mt-1 text-sm leading-relaxed text-blue-100/80">
              {labels.quickFlashcardsSub.replace("{count}", String(dueCount))}
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.12]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-300 to-white transition-[width] duration-700 ease-out"
                style={{ width: `${Math.min(100, Math.max(12, dueCount * 8))}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
