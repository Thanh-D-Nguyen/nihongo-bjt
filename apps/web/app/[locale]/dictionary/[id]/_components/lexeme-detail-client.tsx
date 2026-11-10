"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useGoAuth } from "../../../../../lib/go-auth-provider";
import { AnnotatedJapaneseText } from "../../../../../components/reading-assist/annotated-japanese-text";
import { learnerApiFetchOptional } from "../../../../../lib/learner-api";
import { ContentActions, type ContentActionLabels } from "../../../_components/content-actions";

interface Sense {
  id: string;
  meaningVi: string | null;
  partOfSpeech: string | null;
  position: number;
  exampleLinks: Array<{
    exampleSentence: {
      id: string;
      japaneseText: string;
      reading: string | null;
      translationVi: string | null;
    } | null;
  }>;
}

interface LexemeDetail {
  id: string;
  headword: string;
  reading: string | null;
  jlptLevel: string | null;
  shortMeaningVi: string | null;
  pronunciation: unknown;
  senses: Sense[];
}

interface KanjiInWord {
  id: string;
  character: string;
  meaningVi?: string | null;
}

interface Labels {
  title: string;
  back: string;
  senses: string;
  examples: string;
  partOfSpeech: string;
  loading: string;
  notFound: string;
  error: string;
}

type ReadingAssistLabels = {
  addCardAction: string;
  addCardError: string;
  addCardNoDeck: string;
  addCardSuccess: string;
  bottomSheetClose: string;
  errorHttp: string;
  errorNetwork: string;
  errorTimeout: string;
  furiganaLabel: string;
  lexemeLine: string;
  loadingText: string;
  meaningLabel: string;
  posLabel: string;
  retryAction: string;
  serviceUnavailable: string;
};

export function LexemeDetailClient({
  actionLabels,
  id,
  labels,
  locale,
  readingAssistLabels
}: {
  actionLabels: ContentActionLabels;
  id: string;
  labels: Labels;
  locale: string;
  readingAssistLabels: ReadingAssistLabels;
}) {
  const auth = useGoAuth();
  const userId = auth.userId ?? "";
  const [item, setItem] = useState<LexemeDetail | null>(null);
  const [kanjiList, setKanjiList] = useState<KanjiInWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await learnerApiFetchOptional(`/api/content/lexemes/${id}`);
        if (res.ok) {
          setItem(await res.json());
          const kanjiRes = await learnerApiFetchOptional(`/api/kanji/by-word/${encodeURIComponent(id)}`);
          if (kanjiRes?.ok) {
            const kData: unknown = await kanjiRes.json();
            if (Array.isArray(kData)) setKanjiList(kData as KanjiInWord[]);
          }
        } else {
          setError(true);
        }
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
          {[1, 2, 3].map((i) => <div className="h-16 animate-pulse rounded-xl bg-surface-subtle" key={i} />)}
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="text-sm text-muted">{error ? labels.error : labels.notFound}</p>
        <Link className="mt-2 inline-block text-sm font-medium text-accent hover:underline" href={`/${locale}/dictionary`}>
          ← {labels.back}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link className="text-sm font-medium text-accent hover:underline" href={`/${locale}/dictionary`}>
        ← {labels.back}
      </Link>

      <div className="mt-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="jp-text text-3xl font-bold text-ink" lang="ja">{item.headword}</h1>
          {item.reading ? <span className="jp-text text-lg text-muted" lang="ja">{item.reading}</span> : null}
          {item.jlptLevel ? (
            <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
              {item.jlptLevel}
            </span>
          ) : null}
        </div>
        {item.shortMeaningVi ? (
          <p className="mt-1 text-sm text-muted">{item.shortMeaningVi}</p>
        ) : null}
      </div>

      {/* Actions: bookmark + flashcard */}
      <div className="mt-4">
        <ContentActions
          backText={item.shortMeaningVi ?? item.senses[0]?.meaningVi ?? ""}
          contentId={item.id}
          frontText={item.headword}
          labels={actionLabels}
          targetType="lexeme"
        />
      </div>

      {kanjiList.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            {locale === "ja" ? "構成漢字" : locale === "en" ? "Kanji in this word" : "Chữ Hán trong từ"}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {kanjiList.map((k) => (
              <Link
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5 transition-colors hover:border-accent/40 hover:bg-surface-subtle"
                href={`/${locale}/kanji/${k.id}`}
                key={k.id}
              >
                <span className="jp-text text-lg font-bold text-ink" lang="ja">{k.character}</span>
                {k.meaningVi ? <span className="text-xs text-muted">{k.meaningVi}</span> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {item.senses.length > 0 ? (
        <section className="mt-6 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{labels.senses}</h2>
          {item.senses.map((sense, idx) => (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-sm" key={sense.id}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs font-bold tabular-nums text-muted">{idx + 1}</span>
                {sense.partOfSpeech ? (
                  <span className="rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] font-medium text-muted">
                    {sense.partOfSpeech}
                  </span>
                ) : null}
                <span className="text-sm text-ink">{sense.meaningVi}</span>
              </div>
              {sense.exampleLinks.length > 0 ? (
                <ul className="mt-3 space-y-2 border-l border-border pl-3">
                  {sense.exampleLinks.map((el) =>
                    el.exampleSentence ? (
                      <li className="text-sm" key={el.exampleSentence.id}>
                        {userId ? (
                          <AnnotatedJapaneseText
                            analyzePath="/api/reading-assist/analyze"
                            analyticsPath="/api/reading-assist/analytics"
                            displayMode="hover"
                            labels={readingAssistLabels}
                            text={el.exampleSentence.japaneseText}
                            userId={userId}
                          />
                        ) : (
                          <p className="jp-text font-medium text-ink" lang="ja">{el.exampleSentence.japaneseText}</p>
                        )}
                        {el.exampleSentence.reading ? (
                          <p className="jp-text text-xs text-muted" lang="ja">{el.exampleSentence.reading}</p>
                        ) : null}
                        {el.exampleSentence.translationVi ? (
                          <p className="text-xs text-muted">{el.exampleSentence.translationVi}</p>
                        ) : null}
                      </li>
                    ) : null
                  )}
                </ul>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {/* Cross-links */}
      <nav className="mt-8 flex flex-wrap gap-2 border-t border-border pt-4">
        <Link className="inline-flex min-h-9 items-center rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/30 hover:text-ink" href={`/${locale}/kanji`}>
          {locale === "ja" ? "漢字 →" : "Kanji →"}
        </Link>
        <Link className="inline-flex min-h-9 items-center rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/30 hover:text-ink" href={`/${locale}/grammar`}>
          {locale === "ja" ? "文法 →" : locale === "en" ? "Grammar →" : "Ngữ pháp →"}
        </Link>
      </nav>
    </div>
  );
}
