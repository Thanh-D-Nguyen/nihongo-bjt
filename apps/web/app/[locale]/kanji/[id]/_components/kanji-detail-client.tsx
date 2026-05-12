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
  components: KanjiComponent[];
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
          <div className="h-32 w-32 animate-pulse rounded-2xl bg-[#F3F4F6]" />
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="text-sm text-[#6B7280]">{error ? labels.error : labels.notFound}</p>
        <Link className="mt-2 inline-block text-sm font-medium text-[#3B82F6]" href={`/${locale}/kanji`}>
          ← {labels.back}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link className="text-sm font-medium text-[#3B82F6] hover:underline" href={`/${locale}/kanji`}>
        ← {labels.back}
      </Link>

      {/* Character display */}
      <div className="mt-6 flex flex-col items-center">
        <div className="flex h-36 w-36 items-center justify-center rounded-2xl border-2 border-[#E5E7EB] bg-white shadow-lg">
          <span className="text-7xl font-bold text-[#111827]">{item.character}</span>
        </div>
        <p className="mt-3 text-lg font-medium text-[#4B5563]">{item.meaningVi}</p>
        {item.level != null ? (
          <span className="mt-1 rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-xs font-semibold text-[#1D4ED8]">
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
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-3">
            <p className="text-[10px] font-semibold uppercase text-[#9CA3AF]">{labels.onyomi}</p>
            <p className="mt-1 text-sm font-medium text-[#111827]">{item.onyomi}</p>
          </div>
        ) : null}
        {item.kunyomi ? (
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-3">
            <p className="text-[10px] font-semibold uppercase text-[#9CA3AF]">{labels.kunyomi}</p>
            <p className="mt-1 text-sm font-medium text-[#111827]">{item.kunyomi}</p>
          </div>
        ) : null}
        {item.strokeCount != null ? (
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-3">
            <p className="text-[10px] font-semibold uppercase text-[#9CA3AF]">{labels.strokeCount}</p>
            <p className="mt-1 text-sm font-medium text-[#111827]">{item.strokeCount}</p>
          </div>
        ) : null}
        {item.frequency != null ? (
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-3">
            <p className="text-[10px] font-semibold uppercase text-[#9CA3AF]">{labels.frequency}</p>
            <p className="mt-1 text-sm font-medium text-[#111827]">#{item.frequency}</p>
          </div>
        ) : null}
      </div>

      {/* Components / radicals */}
      {item.components.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#6B7280]">{labels.components}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.components.map((c) => (
              <span
                className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm"
                key={c.id}
              >
                <span className="text-lg font-bold text-[#111827]">{c.character}</span>
                {c.hanViet ? <span className="text-xs text-[#6B7280]">({c.hanViet})</span> : null}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {/* Example words — link to dictionary */}
      {item.examples.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#6B7280]">{labels.examples}</h2>
          <ul className="mt-2 space-y-2">
            {item.examples.map((ex) => (
              <li className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5" key={ex.id}>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-[#111827]">{ex.word}</span>
                  {ex.reading ? <span className="text-xs text-[#9CA3AF]">{ex.reading}</span> : null}
                  {ex.hanViet ? <span className="text-xs text-[#6B7280]">({ex.hanViet})</span> : null}
                </div>
                {ex.meaningVi ? <p className="mt-0.5 text-xs text-[#4B5563]">{ex.meaningVi}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Cross-links */}
      <nav className="mt-8 flex flex-wrap gap-2 border-t border-[#E5E7EB] pt-4">
        <Link className="rounded-lg bg-[#F3F4F6] px-3 py-1.5 text-xs font-medium text-[#4B5563] hover:bg-[#E5E7EB]" href={`/${locale}/dictionary`}>
          📖 Từ điển →
        </Link>
        <Link className="rounded-lg bg-[#F3F4F6] px-3 py-1.5 text-xs font-medium text-[#4B5563] hover:bg-[#E5E7EB]" href={`/${locale}/grammar`}>
          📝 Ngữ pháp →
        </Link>
      </nav>
    </div>
  );
}
