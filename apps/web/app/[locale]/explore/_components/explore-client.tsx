"use client";

import { PageHeader } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { learnerApiFetch } from "../../../../lib/learner-api";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface ExploreLabels {
  title: string;
  subtitle: string;
  dictionary: string;
  dictionaryDesc: string;
  kanji: string;
  kanjiDesc: string;
  grammar: string;
  grammarDesc: string;
  exercises: string;
  exercisesDesc: string;
  levels: string;
  levelsDesc: string;
  magazine: string;
  magazineDesc: string;
  search: string;
  searchDesc: string;
  statsWords: string;
  statsKanji: string;
  statsGrammar: string;
  statsUnavailable: string;
  recentTitle: string;
  recentEmpty: string;
  progressTitle?: string;
  achievements?: string;
  achievementsDesc?: string;
  analytics?: string;
  analyticsDesc?: string;
}

interface ExploreStats {
  lexemes: number;
  kanji: number;
  grammar: number;
}

type ExploreStatsState =
  | { status: "loading" }
  | { status: "ready"; stats: ExploreStats }
  | { status: "unavailable" };

/* ── Constants ─────────────────────────────────────────────────────────── */

const SECTIONS = [
  {
    key: "search",
    href: (l: string) => `/${l}/search`,
    icon: "🔍",
    gradient: "from-accent/10 to-accent/5",
    border: "border-accent/15 hover:border-accent/30",
    hero: true,
  },
  {
    key: "magazine",
    href: (l: string) => `/${l}/magazine`,
    icon: "📰",
    gradient: "from-orange-50 to-orange-50/50 dark:from-orange-950/20 dark:to-orange-950/10",
    border: "border-orange-200/40 hover:border-orange-300/60 dark:border-orange-800/30 dark:hover:border-orange-700/50",
    hero: false,
  },
  {
    key: "dictionary",
    href: (l: string) => `/${l}/dictionary`,
    icon: "📖",
    gradient: "from-blue-50 to-blue-50/50 dark:from-blue-950/20 dark:to-blue-950/10",
    border: "border-blue-200/40 hover:border-blue-300/60 dark:border-blue-800/30 dark:hover:border-blue-700/50",
    hero: false,
  },
  {
    key: "kanji",
    href: (l: string) => `/${l}/kanji`,
    icon: "漢",
    gradient: "from-violet-50 to-violet-50/50 dark:from-violet-950/20 dark:to-violet-950/10",
    border: "border-violet-200/40 hover:border-violet-300/60 dark:border-violet-800/30 dark:hover:border-violet-700/50",
    hero: false,
  },
  {
    key: "grammar",
    href: (l: string) => `/${l}/grammar`,
    icon: "📝",
    gradient: "from-emerald-50 to-emerald-50/50 dark:from-emerald-950/20 dark:to-emerald-950/10",
    border: "border-emerald-200/40 hover:border-emerald-300/60 dark:border-emerald-800/30 dark:hover:border-emerald-700/50",
    hero: false,
  },
  {
    key: "exercises",
    href: (l: string) => `/${l}/exercises`,
    icon: "🧩",
    gradient: "from-amber-50 to-amber-50/50 dark:from-amber-950/20 dark:to-amber-950/10",
    border: "border-amber-200/40 hover:border-amber-300/60 dark:border-amber-800/30 dark:hover:border-amber-700/50",
    hero: false,
  },
  {
    key: "levels",
    href: (l: string) => `/${l}/levels`,
    icon: "📊",
    gradient: "from-rose-50 to-rose-50/50 dark:from-rose-950/20 dark:to-rose-950/10",
    border: "border-rose-200/40 hover:border-rose-300/60 dark:border-rose-800/30 dark:hover:border-rose-700/50",
    hero: false,
  },
] as const;

/* ── Component ─────────────────────────────────────────────────────────── */

export function ExploreClient({ labels, locale }: { labels: ExploreLabels; locale: string }) {
  const [stats, setStats] = useState<ExploreStatsState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const summary = await loadContentSummary();
      if (!cancelled) setStats(summary ? { status: "ready", stats: summary } : { status: "unavailable" });
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const labelMap: Record<string, { name: string; desc: string }> = {
    search: { name: labels.search, desc: labels.searchDesc },
    magazine: { name: labels.magazine, desc: labels.magazineDesc },
    dictionary: { name: labels.dictionary, desc: labels.dictionaryDesc },
    kanji: { name: labels.kanji, desc: labels.kanjiDesc },
    grammar: { name: labels.grammar, desc: labels.grammarDesc },
    exercises: { name: labels.exercises, desc: labels.exercisesDesc },
    levels: { name: labels.levels, desc: labels.levelsDesc },
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader description={labels.subtitle} title={labels.title} />

      {/* ── Stats ribbon ── */}
      {stats.status !== "loading" ? (
        <div className="explore-stats-ribbon flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl border border-ink/6 bg-gradient-to-r from-paper to-surface px-4 py-3 sm:gap-6">
          <StatChip label={labels.statsWords} unavailableLabel={labels.statsUnavailable} value={stats.status === "ready" ? stats.stats.lexemes : null} />
          <div className="hidden h-5 w-px bg-ink/10 sm:block" />
          <StatChip label={labels.statsKanji} unavailableLabel={labels.statsUnavailable} value={stats.status === "ready" ? stats.stats.kanji : null} />
          <div className="hidden h-5 w-px bg-ink/10 sm:block" />
          <StatChip label={labels.statsGrammar} unavailableLabel={labels.statsUnavailable} value={stats.status === "ready" ? stats.stats.grammar : null} />
        </div>
      ) : (
        <div className="flex items-center justify-center gap-6 rounded-2xl border border-ink/6 bg-paper px-4 py-3">
          <div className="explore-skeleton-shimmer h-5 w-16 rounded" />
          <div className="h-5 w-px bg-ink/10" />
          <div className="explore-skeleton-shimmer h-5 w-16 rounded" />
          <div className="h-5 w-px bg-ink/10" />
          <div className="explore-skeleton-shimmer h-5 w-16 rounded" />
        </div>
      )}

      {/* ── Bento grid ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {SECTIONS.map((section) => {
          const { name, desc } = labelMap[section.key];
          const isHero = section.hero;

          return (
            <Link
              className={`explore-card group relative flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-br p-5 transition-all ${section.gradient} ${section.border} ${isHero ? "col-span-2" : ""}`}
              href={section.href(locale)}
              key={section.key}
            >
              {/* icon */}
              <span
                className={`mb-3 flex items-center justify-center rounded-xl bg-white/70 shadow-sm dark:bg-gray-800/50 ${
                  isHero ? "size-14 text-2xl" : "size-11 text-xl"
                } ${section.key === "kanji" ? "font-bold text-violet-600" : ""}`}
              >
                {section.icon}
              </span>

              {/* text */}
              <span className={`font-bold text-ink ${isHero ? "text-lg" : "text-base"}`}>
                {name}
              </span>
              <span className="mt-0.5 text-sm leading-snug text-muted">
                {desc}
              </span>

              {/* arrow indicator */}
              <span className="absolute right-4 top-5 text-muted/30 transition-all group-hover:translate-x-0.5 group-hover:text-muted/60">
                <svg className={isHero ? "size-5" : "size-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </span>
            </Link>
          );
        })}
      </div>

      {/* ── My Progress section (mobile-discoverable) ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted/70">
          {labels.progressTitle ?? "My Progress"}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            className="explore-card group relative flex flex-col overflow-hidden rounded-2xl border border-orange-200/40 bg-gradient-to-br from-orange-50 to-amber-50/50 p-5 transition-all hover:border-orange-300/60 dark:border-orange-800/30 dark:from-orange-950/20 dark:to-amber-950/10"
            href={`/${locale}/achievements`}
          >
            <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-white/70 text-xl shadow-sm dark:bg-gray-800/50">
              🏆
            </span>
            <span className="font-bold text-ink">
              {labels.achievements ?? "Achievements"}
            </span>
            <span className="mt-0.5 text-sm leading-snug text-muted">
              {labels.achievementsDesc ?? "Streaks, badges & leaderboards"}
            </span>
            <span className="absolute right-4 top-5 text-muted/30 transition-all group-hover:translate-x-0.5 group-hover:text-muted/60">
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </span>
          </Link>
          <Link
            className="explore-card group relative flex flex-col overflow-hidden rounded-2xl border border-cyan-200/40 bg-gradient-to-br from-cyan-50 to-blue-50/50 p-5 transition-all hover:border-cyan-300/60 dark:border-cyan-800/30 dark:from-cyan-950/20 dark:to-blue-950/10"
            href={`/${locale}/analytics`}
          >
            <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-white/70 text-xl shadow-sm dark:bg-gray-800/50">
              📈
            </span>
            <span className="font-bold text-ink">
              {labels.analytics ?? "Analytics"}
            </span>
            <span className="mt-0.5 text-sm leading-snug text-muted">
              {labels.analyticsDesc ?? "Charts, trends & insights"}
            </span>
            <span className="absolute right-4 top-5 text-muted/30 transition-all group-hover:translate-x-0.5 group-hover:text-muted/60">
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

async function loadContentSummary(): Promise<ExploreStats | null> {
  try {
    const response = await learnerApiFetch("/api/content/summary");
    if (!response.ok) return null;
    const summary = (await response.json()) as ExploreStats;
    if (![summary.lexemes, summary.kanji, summary.grammar].every((count) => Number.isSafeInteger(count) && count >= 0)) return null;
    return summary;
  } catch {
    return null;
  }
}

function StatChip({ label, unavailableLabel, value }: { label: string; unavailableLabel: string; value: number | null }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span aria-label={value === null ? unavailableLabel : `${value.toLocaleString()} ${label}`} className="text-lg font-bold tabular-nums text-ink">
        {value === null ? "—" : value.toLocaleString()}
      </span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}
