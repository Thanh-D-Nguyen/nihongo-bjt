"use client";

import { ActionCard, Card, CardContent, SectionHeader } from "@nihongo-bjt/ui";
import { IconBattle, IconQuiz, IconReview, IconSearch } from "../../../_components/nav-icons";
import type { HomepageLabels } from "./types";

const actions = [
  {
    key: "flashcards",
    href: (l: string) => `/${l}/flashcards`,
    icon: IconReview
  },
  {
    key: "bjt",
    href: (l: string) => `/${l}/quiz`,
    icon: IconQuiz
  },
  {
    key: "battle",
    href: (l: string) => `/${l}/battle`,
    icon: IconBattle
  },
  {
    key: "search",
    href: (l: string) => `/${l}/search`,
    icon: IconSearch
  }
] as const;

function getLabel(key: string, labels: HomepageLabels): string {
  const map: Record<string, string> = {
    flashcards: labels.quickFlashcards,
    bjt: labels.quickBjt,
    battle: labels.quickBattle,
    search: labels.quickSearch
  };
  return map[key] ?? key;
}

function getSubLabel(key: string, labels: HomepageLabels, dueCount: number): string {
  const map: Record<string, string> = {
    flashcards: labels.quickFlashcardsSub.replace("{count}", String(dueCount)),
    bjt: labels.quickBjtSub,
    battle: labels.quickBattleSub,
    search: labels.quickSearchSub
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="flex gap-4 pt-5">
                <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-paper" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 max-w-[7rem] animate-pulse rounded bg-paper" />
                  <div className="h-3 max-w-[11rem] animate-pulse rounded bg-paper" />
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a) => (
          <ActionCard
            key={a.key}
            href={a.href(locale)}
            icon={<a.icon aria-hidden size={22} />}
            title={getLabel(a.key, labels)}
          >
            <p className="line-clamp-2 text-xs leading-relaxed text-muted">
              {getSubLabel(a.key, labels, dueCount)}
            </p>
          </ActionCard>
        ))}
      </div>
    </section>
  );
}
