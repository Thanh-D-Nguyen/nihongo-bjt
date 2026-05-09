"use client";

import Link from "next/link";
import { Card, CardContent, SectionHeader } from "@nihongo-bjt/ui";
import { IconBattle, IconDocument, IconExercise, IconQuiz, IconReview, IconSearch } from "../../../_components/nav-icons";
import { QaFlashcard, QaBjt, QaBattle, QaSearch, QaStandup, QaReviewInbox } from "./illustrations/qa-icons";
import type { HomepageLabels } from "./types";

const actions = [
  {
    key: "flashcards",
    href: (l: string) => `/${l}/flashcards`,
    icon: IconReview,
    illustration: QaFlashcard,
    color: "from-blue-500 to-blue-600",
    borderAccent: "via-blue-400",
    bgLight: "bg-blue-50",
    textColor: "text-blue-600"
  },
  {
    key: "bjt",
    href: (l: string) => `/${l}/quiz`,
    icon: IconQuiz,
    illustration: QaBjt,
    color: "from-emerald-500 to-emerald-600",
    borderAccent: "via-emerald-400",
    bgLight: "bg-emerald-50",
    textColor: "text-emerald-600"
  },
  {
    key: "battle",
    href: (l: string) => `/${l}/battle`,
    icon: IconBattle,
    illustration: QaBattle,
    color: "from-amber-500 to-orange-500",
    borderAccent: "via-amber-400",
    bgLight: "bg-amber-50",
    textColor: "text-amber-600"
  },
  {
    key: "search",
    href: (l: string) => `/${l}/search`,
    icon: IconSearch,
    illustration: QaSearch,
    color: "from-violet-500 to-purple-600",
    borderAccent: "via-violet-400",
    bgLight: "bg-violet-50",
    textColor: "text-violet-600"
  },
  {
    key: "standup",
    href: (l: string) => `/${l}/daily-standup`,
    icon: IconExercise,
    illustration: QaStandup,
    color: "from-indigo-500 to-blue-700",
    borderAccent: "via-indigo-400",
    bgLight: "bg-indigo-50",
    textColor: "text-indigo-600"
  },
  {
    key: "reviewInbox",
    href: (l: string) => `/${l}/review-inbox-preview`,
    icon: IconDocument,
    illustration: QaReviewInbox,
    color: "from-rose-400 to-pink-600",
    borderAccent: "via-rose-400",
    bgLight: "bg-rose-50",
    textColor: "text-rose-600"
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="flex gap-4 pt-5">
                <div className="h-11 w-11 shrink-0 animate-pulse rounded-[10px] bg-slate-100" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 max-w-[7rem] animate-pulse rounded bg-slate-100" />
                  <div className="h-3 max-w-[11rem] animate-pulse rounded bg-slate-100" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="sr-only">{labels.sectionLoadingHint}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="homepage-quick-actions-heading">
      <SectionHeader id="homepage-quick-actions-heading" title={labels.quickActionsSectionLabel} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((a) => (
          <Link
            key={a.key}
            href={a.href(locale)}
            className="group block rounded-[14px] outline-none transition-all duration-200 hover:-translate-y-[3px] hover:shadow-lg focus-visible:ring-2 focus-visible:ring-blue-500/30"
          >
            <Card className="relative h-full overflow-hidden transition-shadow group-hover:shadow-md">
              {/* Gradient top border accent */}
              <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${a.color} opacity-0 transition-opacity duration-200 group-hover:opacity-100`} />
              <CardContent className="flex gap-4 p-5">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br ${a.color} text-white shadow-sm transition-shadow duration-200 group-hover:shadow-md`}>
                  <a.illustration className="h-7 w-7" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-[#111827]">{getLabel(a.key, labels)}</p>
                  <p className="line-clamp-2 text-xs leading-relaxed text-[#6B7280]">
                    {getSubLabel(a.key, labels, dueCount)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
