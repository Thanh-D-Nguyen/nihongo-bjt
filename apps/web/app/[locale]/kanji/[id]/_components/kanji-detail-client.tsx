"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { learnerApiFetchOptional } from "../../../../../lib/learner-api";
import { ContentActions, type ContentActionLabels } from "../../../_components/content-actions";

interface KanjiComponent {
  id: string;
  character: string;
  hanViet: string | null;
  position: number;
}

interface KanjiExample {
  id: string;
  word: string;
  reading: string | null;
  meaningVi: string | null;
  hanViet: string | null;
}

interface KanjiDetail {
  id: string;
  character: string;
  meaningVi: string | null;
  onyomi: string | null;
  kunyomi: string | null;
  strokeCount: number | null;
  level: number | null;
  frequency: number | null;
  strokeSvgPath: string | null;
  components?: KanjiComponent[];
  examples: KanjiExample[];
}

interface Labels {
  title: string;
  back: string;
  strokeCount: string;
  onyomi: string;
  kunyomi: string;
  components: string;
  examples: string;
  frequency: string;
  loading: string;
  notFound: string;
  error: string;
}

export function KanjiDetailClient({
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
  const [item, setItem] = useState<KanjiDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await learnerApiFetchOptional(`/api/content/kanji/${id}`);
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
        <div className="flex justify-center">
          <div className="h-32 w-32 animate-pulse rounded-2xl bg-surface-subtle" />
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="text-sm text-muted">{error ? labels.error : labels.notFound}</p>
        <Link
          className="mt-2 inline-block text-sm font-medium text-accent hover:underline"
          href={`/${locale}/kanji`}
        >
          ← {labels.back}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link
        className="text-sm font-medium text-accent hover:underline"
        href={`/${locale}/kanji`}
      >
        ← {labels.back}
      </Link>

      {/* Character display */}
      <div className="mt-6 flex flex-col items-center">
        <div className="flex h-36 w-36 items-center justify-center rounded-2xl border border-border bg-surface shadow-sm">
          <span className="jp-text text-7xl font-bold text-ink" lang="ja">{item.character}</span>
        </div>
        <p className="mt-3 text-lg font-medium text-ink">{item.meaningVi}</p>
        {item.level != null ? (
          <span className="mt-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
            N{item.level}
          </span>
        ) : null}
      </div>

      {/* Actions: bookmark + flashcard */}
      <div className="mt-4 flex justify-center">
        <ContentActions
          backText={item.meaningVi ?? ""}
          contentId={item.id}
          frontText={item.character}
          labels={actionLabels}
          targetType="kanji"
        />
      </div>

      {/* Readings + stats */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {item.onyomi ? (
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{labels.onyomi}</p>
            <p className="jp-text mt-1 text-sm font-medium text-ink" lang="ja">{item.onyomi}</p>
          </div>
        ) : null}
        {item.kunyomi ? (
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{labels.kunyomi}</p>
            <p className="jp-text mt-1 text-sm font-medium text-ink" lang="ja">{item.kunyomi}</p>
          </div>
        ) : null}
        {item.strokeCount != null ? (
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              {labels.strokeCount}
            </p>
            <p className="mt-1 text-sm font-medium tabular-nums text-ink">{item.strokeCount}</p>
          </div>
        ) : null}
        {item.frequency != null ? (
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{labels.frequency}</p>
            <p className="mt-1 text-sm font-medium tabular-nums text-ink">#{item.frequency}</p>
          </div>
        ) : null}
      </div>

      {/* Components / radicals — cross-linked to kanji detail */}
      {item.components?.length ? (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            {labels.components}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.components.map((c) => (
              <Link
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:border-accent/40 hover:bg-surface-subtle"
                href={`/${locale}/kanji/${c.id}`}
                key={c.id}
              >
                <span className="jp-text text-lg font-bold text-ink" lang="ja">{c.character}</span>
                {c.hanViet ? <span className="text-xs text-muted">({c.hanViet})</span> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Example words — cross-linked to dictionary detail */}
      {item.examples.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            {labels.examples}
          </h2>
          <ul className="mt-2 space-y-2">
            {item.examples.map((ex) => (
              <li key={ex.id}>
                <Link
                  className="block rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-accent/40 hover:bg-surface-subtle"
                  href={`/${locale}/dictionary/${ex.id}`}
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="jp-text text-sm font-semibold text-ink" lang="ja">{ex.word}</span>
                    {ex.reading ? <span className="jp-text text-xs text-muted" lang="ja">{ex.reading}</span> : null}
                    {ex.hanViet ? (
                      <span className="text-xs text-muted">({ex.hanViet})</span>
                    ) : null}
                  </div>
                  {ex.meaningVi ? (
                    <p className="mt-0.5 text-xs text-muted">{ex.meaningVi}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Cross-links */}
      <nav className="mt-8 flex flex-wrap gap-2 border-t border-border pt-4">
        <Link
          className="inline-flex min-h-9 items-center rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/30 hover:text-ink"
          href={`/${locale}/dictionary`}
        >
          {locale === "ja" ? "辞書 →" : locale === "en" ? "Dictionary →" : "Từ điển →"}
        </Link>
        <Link
          className="inline-flex min-h-9 items-center rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/30 hover:text-ink"
          href={`/${locale}/grammar`}
        >
          {locale === "ja" ? "文法 →" : locale === "en" ? "Grammar →" : "Ngữ pháp →"}
        </Link>
      </nav>
    </div>
  );
}
