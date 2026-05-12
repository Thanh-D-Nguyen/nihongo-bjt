"use client";

import Link from "next/link";
import { SectionHeader } from "@nihongo-bjt/ui";
import { QaFlashcard, QaBjt, QaBattle, QaSearch, QaStandup, QaReviewInbox } from "./illustrations/qa-icons";
import type { HomepageLabels } from "./types";

const actions = [
  {
    key: "flashcards",
    href: (l: string) => `/${l}/flashcards`,
    illustration: QaFlashcard,
    gradient: "from-blue-500 via-blue-600 to-indigo-700",
    iconBg: "bg-white/20",
    featured: true,
  },
  {
    key: "bjt",
    href: (l: string) => `/${l}/quiz`,
    illustration: QaBjt,
    gradient: "from-amber-500 via-orange-500 to-amber-700",
    iconBg: "bg-white/20",
    featured: true,
  },
  {
    key: "battle",
    href: (l: string) => `/${l}/battle`,
    illustration: QaBattle,
    gradient: "from-pink-500 via-rose-500 to-fuchsia-600",
    iconBg: "bg-white/20",
    featured: false,
  },
  {
    key: "search",
    href: (l: string) => `/${l}/search`,
    illustration: QaSearch,
    gradient: "from-teal-500 via-cyan-500 to-emerald-600",
    iconBg: "bg-white/20",
    featured: false,
  },
  {
    key: "standup",
    href: (l: string) => `/${l}/daily-standup`,
    illustration: QaStandup,
    gradient: "from-indigo-500 via-violet-500 to-purple-600",
    iconBg: "bg-white/20",
    featured: false,
  },
  {
    key: "reviewInbox",
    href: (l: string) => `/${l}/review-inbox-preview`,
    illustration: QaReviewInbox,
    gradient: "from-rose-500 via-red-500 to-pink-600",
    iconBg: "bg-white/20",
    featured: false,
  }
] as const;

function getLabel(key: string, labels: HomepageLabels): string {
  const map: Record<string, string> = {
    flashcards: labels.quickFlashcards,
    bjt: labels.quickBjt,
    battle: labels.quickBattle,
    search: labels.quickSearch,
    standup: labels.quickStandup,
    reviewInbox: labels.quickReviewInbox
  };
  return map[key] ?? key;
}

function getSubLabel(key: string, labels: HomepageLabels, dueCount: number): string {
  const map: Record<string, string> = {
    flashcards: labels.quickFlashcardsSub.replace("{count}", String(dueCount)),
    bjt: labels.quickBjtSub,
    battle: labels.quickBattleSub,
    search: labels.quickSearchSub,
    standup: labels.quickStandupSub,
    reviewInbox: labels.quickReviewInboxSub
  };
  return map[key] ?? "";
}

export function QuickActionsStrip({
  hubReady,
  labels,
  locale,
  dueCount
}: {
  hubReady: boolean;
  labels: HomepageLabels;
  locale: string;
  dueCount: number;
}) {
  if (!hubReady) {
    return (
      <section aria-busy aria-labelledby="homepage-quick-actions-heading">
        <SectionHeader
          id="homepage-quick-actions-heading"
          title={labels.quickActionsSectionLabel}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={`animate-pulse rounded-2xl bg-slate-100 ${i <= 2 ? "sm:row-span-2 min-h-[200px]" : "min-h-[110px]"}`} />
          ))}
        </div>
        <p className="sr-only">{labels.sectionLoadingHint}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="homepage-quick-actions-heading">
      <SectionHeader id="homepage-quick-actions-heading" title={labels.quickActionsSectionLabel} />
      {/* Bento grid: 2 featured tall cards + 4 compact cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {actions.map((a) => {
          const isFeatured = a.featured;
          return (
            <Link
              key={a.key}
              href={a.href(locale)}
              className={`group relative block overflow-hidden rounded-2xl outline-none transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-white/50 active:scale-[0.97] active:duration-100 ${isFeatured ? "sm:row-span-2" : ""}`}
            >
              {/* Full-color gradient background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${a.gradient} opacity-90 transition-opacity duration-300 group-hover:opacity-100`} />

              {/* Decorative circles */}
              <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/[0.07]" />
              <div className="pointer-events-none absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/[0.05]" />

              <div className={`relative flex flex-col ${isFeatured ? "min-h-[200px] justify-between p-6" : "min-h-[110px] justify-between p-4"}`}>
                {/* Icon */}
                <div className={`flex ${isFeatured ? "h-14 w-14" : "h-11 w-11"} items-center justify-center rounded-xl ${a.iconBg} backdrop-blur-sm shadow-sm`}>
                  <a.illustration className={`${isFeatured ? "h-8 w-8" : "h-6 w-6"} text-white drop-shadow-sm`} />
                </div>

                {/* Text */}
                <div className={`${isFeatured ? "mt-auto" : "mt-2"}`}>
                  <p className={`font-bold text-white ${isFeatured ? "text-lg" : "text-sm"}`}>
                    {getLabel(a.key, labels)}
                  </p>
                  <p className={`mt-0.5 text-white/70 ${isFeatured ? "text-sm" : "text-[11px]"} leading-relaxed line-clamp-2`}>
                    {getSubLabel(a.key, labels, dueCount)}
                  </p>
                </div>

                {/* Arrow indicator */}
                <div className="absolute bottom-4 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0.5">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
