"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { HomepageLabels } from "./types";
import { getCurrentSeason, getSeasonTheme } from "./seasonal";
import { HeroCitySilhouette } from "./illustrations/hero-city";
import { SeasonalOverlay } from "./illustrations/seasonal-elements";
import { toIntlLocale } from "@/lib/locale-utils";

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
        <div className="overflow-hidden rounded-[20px] bg-gradient-to-br from-[#1B2A4A] via-[#1E3A5F] to-[#2563EB]">
          <div className="grid gap-5 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div>
              <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
              <div className="mt-4 h-10 max-w-md animate-pulse rounded-lg bg-white/10" />
              <div className="mt-3 h-4 max-w-lg animate-pulse rounded bg-white/10" />
              <div className="mt-8 flex flex-wrap gap-3">
                <div className="h-12 w-40 animate-pulse rounded-xl bg-white/10" />
                <div className="h-12 w-28 animate-pulse rounded-xl bg-white/10" />
              </div>
            </div>
            <div className="hidden min-h-36 animate-pulse rounded-2xl bg-white/[0.06] lg:block" />
          </div>
        </div>
        <p className="sr-only">{labels.sectionLoadingHint}</p>
      </section>
    );
  }

  return (
    <section>
      <div
        ref={heroRef}
        className="relative isolate overflow-hidden rounded-[20px] shadow-[0_20px_60px_-12px_rgba(27,42,74,0.4)]"
        style={{ '--hero-scroll': '0' } as React.CSSProperties}
      >
        {/* Animated gradient mesh background */}
        <div
          className="absolute inset-0 hero-gradient-shift"
          style={{
            background: "linear-gradient(135deg, #1B2A4A 0%, #1E3A5F 25%, #2563EB 50%, #1E3A5F 75%, #1B2A4A 100%)",
            backgroundSize: "300% 300%",
          }}
        />

        {/* Layered decorative background */}
        <div className="pointer-events-none absolute inset-0">
          {/* Large radial glow — creates depth */}
          <div className="absolute -left-20 -top-20 h-[400px] w-[400px] rounded-full bg-blue-500/15 blur-3xl" />
          <div className="absolute -bottom-32 -right-20 h-[320px] w-[320px] rounded-full bg-indigo-400/10 blur-3xl" />
          <div className="absolute right-[20%] top-[15%] h-32 w-32 rounded-full bg-amber-300/10 blur-2xl" />

          {/* Seasonal overlay tint */}
          <div className="absolute inset-0" style={{ background: theme.heroTint }} />

          {/* Seasonal decorative elements */}
          <SeasonalOverlay className="opacity-70" season={season} />

          {/* City silhouette — parallax */}
          <HeroCitySilhouette
            className="absolute -bottom-2 right-0 hidden w-[55%] max-w-[440px] text-white/[0.08] motion-safe:translate-y-[calc(var(--hero-scroll)*-30px)] lg:block"
          />
          <HeroCitySilhouette
            className="absolute -bottom-1 right-0 w-[85%] text-white/[0.06] lg:hidden"
          />

          {/* Decorative grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }} />
        </div>

        <div className="relative px-6 py-10 sm:px-10 sm:py-14 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center">
            <div className="min-w-0">
              {/* Eyebrow badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-blue-100/90">
                  {labels.cockpitEyebrow}
                </span>
              </div>

              {/* Date */}
              <p className="mt-4 text-sm font-medium text-blue-200/60">
                {new Date().toLocaleDateString(toIntlLocale(locale), {
                  weekday: "long",
                  month: "long",
                  day: "numeric"
                })}
              </p>

              {/* Main greeting — much bigger */}
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
                <span className="drop-shadow-[0_2px_20px_rgba(0,0,0,0.25)]">
                  {greeting}
                </span>
              </h1>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-blue-100/80 sm:text-lg">
                {primaryLine}
              </p>

              {/* CTA cluster — bigger, bolder */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white dark:bg-white px-5 text-[15px] font-bold text-[#1B2A4A] dark:text-[#1B2A4A] shadow-[0_4px_24px_rgba(255,255,255,0.25)] outline-none transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-50 hover:shadow-[0_8px_32px_rgba(255,255,255,0.35)] focus-visible:ring-2 focus-visible:ring-white/60 active:scale-[0.97] sm:px-7"
                  href={primaryHref}
                >
                  <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                  {primaryCta}
                </Link>
                <Link
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 bg-white/[0.08] px-6 text-[15px] font-semibold text-white/90 outline-none backdrop-blur-md transition-all duration-200 hover:border-white/35 hover:bg-white/[0.15] focus-visible:ring-2 focus-visible:ring-white/50"
                  href={secondaryHref}
                >
                  {secondaryLabel}
                </Link>
                <Link
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-400/[0.1] px-5 text-[15px] font-semibold text-amber-100/90 outline-none backdrop-blur-sm transition-all duration-200 hover:border-amber-300/40 hover:bg-amber-400/[0.2] focus-visible:ring-2 focus-visible:ring-white/50"
                  href={`/${locale}/daily-standup`}
                >
                  {labels.cockpitTertiaryToStandup}
                </Link>
              </div>
            </div>

            {/* Stats card — prominent glassmorphism */}
            <div className="rounded-2xl border border-white/[0.12] bg-white/[0.07] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_40px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                  <svg aria-hidden className="h-4 w-4 text-blue-300" fill="currentColor" viewBox="0 0 20 20"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" /></svg>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-200/80">
                  {labels.quickBjt}
                </p>
              </div>
              <p className="mt-4 text-4xl font-black tabular-nums tracking-tight text-white">{dueCount}</p>
              <p className="mt-1 text-sm leading-relaxed text-blue-100/60">
                {labels.quickFlashcardsSub.replace("{count}", String(dueCount))}
              </p>
              <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 via-blue-300 to-white/80 transition-[width] duration-700 ease-out"
                  style={{ width: `${Math.min(100, Math.max(12, dueCount * 8))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
