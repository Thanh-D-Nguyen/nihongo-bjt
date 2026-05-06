"use client";

import Link from "next/link";
import { ScrollStrip } from "../../../_components/scroll-strip";
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

function QuizCard({
  template,
  labels,
  locale,
}: {
  template: QuizTemplate;
  labels: HomepageLabels;
  locale: string;
}) {
  const title = locale === "ja" ? (template.titleJa ?? template.titleVi ?? "—") : (template.titleVi ?? template.titleJa ?? "—");

  return (
    <Link
      href={`/${locale}/quiz/${template.id}`}
      className="group flex w-[200px] shrink-0 flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink/5 transition-all hover:shadow-md hover:-translate-y-0.5 sm:w-[220px]"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-leaf-soft text-leaf ring-1 ring-leaf/20 shadow-sm">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" strokeLinecap="round" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="m9 14 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h3 className="line-clamp-2 text-sm font-semibold text-ink">{title}</h3>

      <div className="mt-auto flex items-center gap-2 pt-2">
        {template.level && (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
            {template.level}
          </span>
        )}
        <span className="text-[10px] text-muted">
          {labels.recommendSectionCount.replace("{n}", String(template._count.sections))}
        </span>
      </div>
    </Link>
  );
}

function DeckCard({
  deck,
  labels,
  locale,
}: {
  deck: DeckSummary;
  labels: HomepageLabels;
  locale: string;
}) {
  const title = locale === "ja" ? (deck.titleJa ?? deck.titleVi) : deck.titleVi;

  return (
    <Link
      href={`/${locale}/flashcards`}
      className="group flex w-[200px] shrink-0 flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink/5 transition-all hover:shadow-md hover:-translate-y-0.5 sm:w-[220px]"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-paper text-ink ring-1 ring-ink/10 shadow-sm">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18" />
        </svg>
      </div>

      <h3 className="line-clamp-2 text-sm font-semibold text-ink">{title}</h3>

      <p className="mt-auto pt-2 text-[10px] text-muted">
        {labels.recommendDeckCardCount.replace("{n}", String(deck.cardCount))}
      </p>
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
  if (loading) {
    return (
      <section aria-busy>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink sm:text-xl">{labels.recommendTitle}</h2>
            <p className="text-sm text-muted">{labels.recommendSubtitle}</p>
          </div>
        </div>
        <div className="flex gap-3 overflow-hidden pb-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              className="h-36 w-[200px] shrink-0 animate-pulse rounded-2xl bg-paper ring-1 ring-ink/5 sm:w-[220px]"
              key={i}
            />
          ))}
        </div>
        <p className="sr-only">{labels.sectionLoadingHint}</p>
      </section>
    );
  }

  if (quizTemplates.length === 0 && decks.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink sm:text-xl">{labels.recommendTitle}</h2>
          <p className="text-sm text-muted">{labels.recommendSubtitle}</p>
        </div>
      </div>

      <ScrollStrip>
        {quizTemplates.map((t) => (
          <QuizCard key={t.id} labels={labels} locale={locale} template={t} />
        ))}
        {decks.map((d) => (
          <DeckCard key={d.id} deck={d} labels={labels} locale={locale} />
        ))}
      </ScrollStrip>
    </section>
  );
}
