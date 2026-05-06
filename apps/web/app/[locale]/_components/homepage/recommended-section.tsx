"use client";

import { Badge, Card, CardContent, EmptyState, LoadingSkeleton, ProgressBar, SectionHeader } from "@nihongo-bjt/ui";
import Link from "next/link";

import { IconDeck, IconQuiz, IconReview, IconSpark } from "../../../_components/app-icons";
import type { HomepageLabels } from "./types";

export interface QuizTemplate {
  id: string;
  titleVi?: string;
  titleJa?: string;
  level?: string;
  _count: { sections: number };
}

export interface DeckSummary {
  id: string;
  titleVi: string;
  titleJa: string | null;
  cardCount: number;
  visibility: string;
}

type Recommendation =
  | {
      href: string;
      icon: typeof IconQuiz;
      id: string;
      kind: string;
      meta: string;
      progress: number;
      reason: string;
      title: string;
    }
  | {
      href: string;
      icon: typeof IconDeck;
      id: string;
      kind: string;
      meta: string;
      progress: number;
      reason: string;
      title: string;
    };

function titleFor(locale: string, vi?: string | null, ja?: string | null) {
  return locale === "ja" ? (ja || vi || "—") : (vi || ja || "—");
}

function RecommendationCard({ item, labels }: { item: Recommendation; labels: HomepageLabels }) {
  return (
    <Link
      className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      href={item.href}
    >
      <Card className="flex h-full min-h-52 flex-col rounded-xl shadow-sm transition group-hover:border-accent/25 group-hover:shadow-md">
        <CardContent className="flex h-full flex-col p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-xl border border-accent/15 bg-accent/8 text-accent">
              <item.icon aria-hidden size={24} />
            </span>
            <Badge>{item.kind}</Badge>
          </div>
          <h3 className="mt-4 line-clamp-2 text-sm font-semibold leading-snug text-ink">{item.title}</h3>
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">{item.reason}</p>
          <div className="mt-auto space-y-3 pt-4">
            <ProgressBar value={item.progress} />
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-muted">{item.meta}</span>
              <span className="shrink-0 font-semibold text-accent">{labels.newsReadMore}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function RecommendedSection({
  quizTemplates,
  decks,
  labels,
  loading,
  locale,
}: {
  quizTemplates: QuizTemplate[];
  decks: DeckSummary[];
  labels: HomepageLabels;
  loading?: boolean;
  locale: string;
}) {
  const recommendations: Recommendation[] = [
    ...quizTemplates.slice(0, 3).map((template) => ({
      href: `/${locale}/quiz`,
      icon: IconQuiz,
      id: `quiz-${template.id}`,
      kind: template.level ? `${labels.quickBjt} · ${template.level}` : labels.quickBjt,
      meta: labels.recommendSectionCount.replace("{n}", String(template._count.sections)),
      progress: Math.min(92, Math.max(28, template._count.sections * 14)),
      reason: template.level
        ? labels.recommendReasonLevel.replace("{level}", template.level)
        : labels.recommendReasonBjt,
      title: titleFor(locale, template.titleVi, template.titleJa)
    })),
    ...decks.slice(0, 3).map((deck) => ({
      href: `/${locale}/flashcards?deckId=${deck.id}`,
      icon: IconDeck,
      id: `deck-${deck.id}`,
      kind: labels.quickFlashcards,
      meta: labels.recommendDeckCardCount.replace("{n}", String(deck.cardCount)),
      progress: Math.min(96, Math.max(18, deck.cardCount * 4)),
      reason: labels.recommendReasonDeck,
      title: titleFor(locale, deck.titleVi, deck.titleJa)
    }))
  ].slice(0, 6);

  if (loading) {
    return (
      <section aria-busy>
        <SectionHeader description={labels.recommendSubtitle} title={labels.recommendTitle} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <LoadingSkeleton className="h-52 rounded-xl" key={i} />
          ))}
        </div>
        <p className="sr-only">{labels.sectionLoadingHint}</p>
      </section>
    );
  }

  if (recommendations.length === 0) {
    return (
      <section>
        <SectionHeader description={labels.recommendSubtitle} title={labels.recommendTitle} />
        <EmptyState description={labels.recommendEmpty} title={labels.recommendTitle} />
      </section>
    );
  }

  const primary = recommendations[0];
  const rest = recommendations.slice(1);

  return (
    <section>
      <SectionHeader
        actions={
          <Link className="text-sm font-semibold text-accent transition hover:text-accent/80" href={`/${locale}/flashcards`}>
            {labels.recommendViewAll}
          </Link>
        }
        description={labels.recommendSubtitle}
        title={labels.recommendTitle}
      />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,2fr)]">
        {primary ? (
          <Card className="rounded-xl border-accent/20 bg-accent/8 shadow-sm">
            <CardContent className="flex h-full min-h-56 flex-col p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-accent">
                <IconSpark aria-hidden size={16} />
                {labels.recommendPrimary}
              </div>
              <h3 className="mt-4 text-lg font-semibold leading-tight text-ink">{primary.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/75">{primary.reason}</p>
              <div className="mt-auto pt-5">
                <ProgressBar value={primary.progress} />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-muted">{primary.meta}</span>
                  <Link
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-surface transition hover:bg-ink/90"
                    href={primary.href}
                  >
                    <IconReview aria-hidden size={16} />
                    {labels.recommendStart}
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((item) => (
            <RecommendationCard item={item} key={item.id} labels={labels} />
          ))}
        </div>
      </div>
    </section>
  );
}
