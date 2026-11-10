"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { learnerApiFetchOptional } from "../../../../../lib/learner-api";
import { ContentActions, type ContentActionLabels } from "../../../_components/content-actions";
import { GrammarRichText } from "../../_components/grammar-rich-text";

interface GrammarPointDetailItem {
  id: string;
  meaningVi: string | null;
  explanation: string | null;
  note: string | null;
  synopsis: string | null;
  position: number;
}

interface GrammarPointDetail {
  id: string;
  pattern: string;
  meaningVi: string | null;
  jlptLevel: string | null;
  category: string | null;
  details: GrammarPointDetailItem[];
}

interface Labels {
  title: string;
  back: string;
  explanation: string;
  note: string;
  synopsis: string;
  details: string;
  loading: string;
  notFound: string;
  error: string;
}

export function GrammarDetailClient({
  actionLabels,
  id,
  labels,
  locale
}: {
  actionLabels: ContentActionLabels;
  id: string;
  labels: Labels;
  locale: string;
}) {
  const [item, setItem] = useState<GrammarPointDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await learnerApiFetchOptional(`/api/content/grammar/${id}`);
        if (res.ok) setItem(await res.json());
        else setError(true);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="h-8 w-48 animate-pulse rounded bg-surface-subtle" />
        <div className="mt-4 space-y-3">
          {[1, 2].map((i) => <div className="h-24 animate-pulse rounded-xl bg-surface-subtle" key={i} />)}
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="text-sm text-muted">{error ? labels.error : labels.notFound}</p>
        <Link className="mt-2 inline-block text-sm font-medium text-accent hover:underline" href={`/${locale}/grammar`}>
          ← {labels.back}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link className="text-sm font-medium text-accent hover:underline" href={`/${locale}/grammar`}>
        ← {labels.back}
      </Link>

      <div className="mt-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="jp-text text-2xl font-bold text-ink" lang="ja">{item.pattern}</h1>
          {item.jlptLevel ? (
            <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
              {item.jlptLevel}
            </span>
          ) : null}
          {item.category ? (
            <span className="text-xs text-muted">{item.category}</span>
          ) : null}
        </div>
        {item.meaningVi ? (
          <p className="mt-2 text-base text-muted">{item.meaningVi}</p>
        ) : null}
      </div>

      {/* Actions: bookmark + flashcard */}
      <div className="mt-4">
        <ContentActions
          backText={item.meaningVi ?? ""}
          contentId={item.id}
          frontText={item.pattern}
          labels={actionLabels}
          targetType="grammar"
        />
      </div>

      {item.details.length > 0 ? (
        <section className="mt-6 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{labels.details}</h2>
          {item.details.map((d, idx) => (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm" key={d.id}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs font-bold tabular-nums text-muted">{idx + 1}</span>
                {d.meaningVi ? (
                  <span className="text-sm font-medium text-ink">{d.meaningVi}</span>
                ) : null}
              </div>
              {d.explanation ? (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{labels.explanation}</p>
                  <GrammarRichText className="mt-0.5 text-muted" html={d.explanation} />
                </div>
              ) : null}
              {d.note ? (
                <div className="mt-2 rounded-lg border border-warning/25 bg-warning-bg p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-warning">{labels.note}</p>
                  <p className="mt-0.5 text-sm text-ink">{d.note}</p>
                </div>
              ) : null}
              {d.synopsis ? (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{labels.synopsis}</p>
                  <p className="mt-0.5 text-sm text-muted">{d.synopsis}</p>
                </div>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {/* Cross-links */}
      <nav className="mt-8 flex flex-wrap gap-2 border-t border-border pt-4">
        <Link className="inline-flex min-h-9 items-center rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/30 hover:text-ink" href={`/${locale}/dictionary`}>
          {locale === "ja" ? "辞書 →" : locale === "en" ? "Dictionary →" : "Từ điển →"}
        </Link>
        <Link className="inline-flex min-h-9 items-center rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/30 hover:text-ink" href={`/${locale}/kanji`}>
          {locale === "ja" ? "漢字 →" : "Kanji →"}
        </Link>
      </nav>
    </div>
  );
}
