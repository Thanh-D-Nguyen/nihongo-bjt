"use client";

import Link from "next/link";
import type { HomepageLabels } from "./types";

const actions = [
  {
    key: "flashcards",
    href: (l: string) => `/${l}/flashcards`,
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 10h18" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "bjt",
    href: (l: string) => `/${l}/quiz`,
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" strokeLinecap="round" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="m9 14 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "battle",
    href: (l: string) => `/${l}/battle`,
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
        <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "search",
    href: (l: string) => `/${l}/search`,
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" strokeLinecap="round" />
      </svg>
    ),
  },
] as const;

function getLabel(key: string, labels: HomepageLabels): string {
  const map: Record<string, string> = {
    flashcards: labels.quickFlashcards,
    bjt: labels.quickBjt,
    battle: labels.quickBattle,
    search: labels.quickSearch,
  };
  return map[key] ?? key;
}

function getSubLabel(key: string, labels: HomepageLabels, dueCount: number): string {
  const map: Record<string, string> = {
    flashcards: labels.quickFlashcardsSub.replace("{count}", String(dueCount)),
    bjt: labels.quickBjtSub,
    battle: labels.quickBattleSub,
    search: labels.quickSearchSub,
  };
  return map[key] ?? "";
}

export function QuickActionsStrip({
  hubReady,
  labels,
  locale,
  dueCount,
}: {
  hubReady: boolean;
  labels: HomepageLabels;
  locale: string;
  dueCount: number;
}) {
  if (!hubReady) {
    return (
      <section aria-busy aria-labelledby="homepage-quick-actions-heading">
        <h2 className="mb-3 text-base font-bold text-ink sm:text-lg" id="homepage-quick-actions-heading">
          {labels.quickActionsSectionLabel}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              className="flex flex-col items-center gap-2 rounded-2xl border border-ink/10 bg-surface p-4 sm:p-5"
              key={i}
            >
              <div className="h-11 w-11 animate-pulse rounded-xl bg-paper" />
              <div className="h-4 w-20 animate-pulse rounded bg-paper" />
              <div className="h-3 w-full max-w-[7rem] animate-pulse rounded bg-paper" />
            </div>
          ))}
        </div>
        <p className="sr-only">{labels.sectionLoadingHint}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="homepage-quick-actions-heading">
      <h2 className="mb-3 text-base font-bold text-ink sm:text-lg" id="homepage-quick-actions-heading">
        {labels.quickActionsSectionLabel}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {actions.map((a) => (
          <Link
            key={a.key}
            href={a.href(locale)}
            className="group flex flex-col items-center gap-2 rounded-2xl border border-ink/10 bg-surface p-4 text-center shadow-sm outline-none ring-offset-2 transition hover:border-ink/18 hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.99] sm:p-5"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-leaf-soft text-leaf ring-1 ring-leaf/15 transition group-hover:bg-leaf/10">
              {a.icon}
            </div>
            <span className="text-sm font-semibold text-ink">{getLabel(a.key, labels)}</span>
            <span className="line-clamp-2 min-h-8 text-xs text-muted">{getSubLabel(a.key, labels, dueCount)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
