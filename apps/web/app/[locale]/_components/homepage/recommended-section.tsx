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
      className="group block rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
      href={item.href}
    >
      <Card className="flex h-full min-h-52 flex-col rounded-[14px] shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
        <CardContent className="flex h-full flex-col p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-[10px] bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
              <item.icon aria-hidden size={24} />
            </span>
            <Badge>{item.kind}</Badge>
          </div>
          <h3 className="mt-4 line-clamp-2 text-sm font-semibold leading-snug text-[#111827]">{item.title}</h3>
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#4B5563]">{item.reason}</p>
          <div className="mt-auto space-y-3 pt-4">
            <ProgressBar value={item.progress} />
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-[#6B7280]">{item.meta}</span>
              <span className="shrink-0 font-semibold text-[#3B82F6]">{labels.newsReadMore}</span>
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
          <Link className="text-sm font-semibold text-[#3B82F6] transition hover:text-[#2563EB]" href={`/${locale}/flashcards`}>
            {labels.recommendViewAll}
          </Link>
        }
        description={labels.recommendSubtitle}
        title={labels.recommendTitle}
      />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,2fr)]">
        {primary ? (
          <Card className="overflow-hidden rounded-[14px] border-0 bg-gradient-to-br from-[#1B2A4A] to-[#2563EB] shadow-lg">
            <CardContent className="flex h-full min-h-56 flex-col p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-blue-200">
                <IconSpark aria-hidden size={16} />
                {labels.recommendPrimary}
              </div>
              <h3 className="mt-4 text-lg font-semibold leading-tight text-white">{primary.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-blue-100/80">{primary.reason}</p>
              <div className="mt-auto pt-5">
                <div className="h-2 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-white/80 transition-[width] duration-300" style={{ width: `${primary.progress}%` }} />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-blue-200">{primary.meta}</span>
                  <Link
                    className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-white px-4 text-sm font-semibold text-[#1B2A4A] shadow-md transition-all duration-150 hover:bg-blue-50"
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
