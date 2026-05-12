"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useKeycloakAuth } from "../../../../../components/auth/keycloak-auth-provider";
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
  const auth = useKeycloakAuth();
  const userId = auth.userId ?? "";
  const [item, setItem] = useState<LexemeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await learnerApiFetchOptional(`/api/content/lexemes/${id}`);
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
        <div className="h-8 w-48 animate-pulse rounded bg-[#F3F4F6]" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => <div className="h-16 animate-pulse rounded-xl bg-[#F3F4F6]" key={i} />)}
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="text-sm text-[#6B7280]">{error ? labels.error : labels.notFound}</p>
        <Link className="mt-2 inline-block text-sm font-medium text-[#3B82F6]" href={`/${locale}/dictionary`}>
          ← {labels.back}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link className="text-sm font-medium text-[#3B82F6] hover:underline" href={`/${locale}/dictionary`}>
        ← {labels.back}
      </Link>

      <div className="mt-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-bold text-[#111827]">{item.headword}</h1>
          {item.reading ? <span className="text-lg text-[#6B7280]">{item.reading}</span> : null}
          {item.jlptLevel ? (
            <span className="rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-xs font-semibold text-[#1D4ED8]">
              {item.jlptLevel}
            </span>
          ) : null}
        </div>
        {item.shortMeaningVi ? (
          <p className="mt-1 text-sm text-[#4B5563]">{item.shortMeaningVi}</p>
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

      {item.senses.length > 0 ? (
        <section className="mt-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#6B7280]">{labels.senses}</h2>
          {item.senses.map((sense, idx) => (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm" key={sense.id}>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-bold text-[#9CA3AF]">{idx + 1}</span>
                {sense.partOfSpeech ? (
                  <span className="rounded bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-medium text-[#4B5563]">
                    {sense.partOfSpeech}
                  </span>
                ) : null}
                <span className="text-sm text-[#111827]">{sense.meaningVi}</span>
              </div>
              {sense.exampleLinks.length > 0 ? (
                <ul className="mt-3 space-y-2 border-l-2 border-[#E5E7EB] pl-3">
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
                          <p className="font-medium text-[#111827]">{el.exampleSentence.japaneseText}</p>
                        )}
                        {el.exampleSentence.reading ? (
                          <p className="text-xs text-[#9CA3AF]">{el.exampleSentence.reading}</p>
                        ) : null}
                        {el.exampleSentence.translationVi ? (
                          <p className="text-xs text-[#6B7280]">{el.exampleSentence.translationVi}</p>
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
      <nav className="mt-8 flex flex-wrap gap-2 border-t border-[#E5E7EB] pt-4">
        <Link className="rounded-lg bg-[#F3F4F6] px-3 py-1.5 text-xs font-medium text-[#4B5563] hover:bg-[#E5E7EB]" href={`/${locale}/kanji`}>
          漢字 Kanji →
        </Link>
        <Link className="rounded-lg bg-[#F3F4F6] px-3 py-1.5 text-xs font-medium text-[#4B5563] hover:bg-[#E5E7EB]" href={`/${locale}/grammar`}>
          📝 Ngữ pháp →
        </Link>
      </nav>
    </div>
  );
}
