"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { learnerApiFetchOptional } from "../../../../../lib/learner-api";
import { ContentActions, type ContentActionLabels } from "../../../_components/content-actions";

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
        <div className="h-8 w-48 animate-pulse rounded bg-[#F3F4F6]" />
        <div className="mt-4 space-y-3">
          {[1, 2].map((i) => <div className="h-24 animate-pulse rounded-xl bg-[#F3F4F6]" key={i} />)}
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="text-sm text-[#6B7280]">{error ? labels.error : labels.notFound}</p>
        <Link className="mt-2 inline-block text-sm font-medium text-[#8B5CF6]" href={`/${locale}/grammar`}>
          ← {labels.back}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link className="text-sm font-medium text-[#8B5CF6] hover:underline" href={`/${locale}/grammar`}>
        ← {labels.back}
      </Link>

      <div className="mt-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold text-[#111827]">{item.pattern}</h1>
          {item.jlptLevel ? (
            <span className="rounded-full bg-[#F5F3FF] px-2.5 py-0.5 text-xs font-semibold text-[#7C3AED]">
              {item.jlptLevel}
            </span>
          ) : null}
          {item.category ? (
            <span className="text-xs text-[#9CA3AF]">{item.category}</span>
          ) : null}
        </div>
        {item.meaningVi ? (
          <p className="mt-2 text-base text-[#4B5563]">{item.meaningVi}</p>
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#6B7280]">{labels.details}</h2>
          {item.details.map((d, idx) => (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm" key={d.id}>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-bold text-[#9CA3AF]">{idx + 1}</span>
                {d.meaningVi ? (
                  <span className="text-sm font-medium text-[#111827]">{d.meaningVi}</span>
                ) : null}
              </div>
              {d.explanation ? (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold uppercase text-[#9CA3AF]">{labels.explanation}</p>
                  <p className="mt-0.5 text-sm text-[#4B5563]">{d.explanation}</p>
                </div>
              ) : null}
              {d.note ? (
                <div className="mt-2 rounded-lg bg-[#FFFBEB] p-2">
                  <p className="text-[10px] font-semibold uppercase text-[#92400E]">{labels.note}</p>
                  <p className="mt-0.5 text-sm text-[#78350F]">{d.note}</p>
                </div>
              ) : null}
              {d.synopsis ? (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold uppercase text-[#9CA3AF]">{labels.synopsis}</p>
                  <p className="mt-0.5 text-sm text-[#6B7280]">{d.synopsis}</p>
                </div>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {/* Cross-links */}
      <nav className="mt-8 flex flex-wrap gap-2 border-t border-[#E5E7EB] pt-4">
        <Link className="rounded-lg bg-[#F3F4F6] px-3 py-1.5 text-xs font-medium text-[#4B5563] hover:bg-[#E5E7EB]" href={`/${locale}/dictionary`}>
          📖 Từ điển →
        </Link>
        <Link className="rounded-lg bg-[#F3F4F6] px-3 py-1.5 text-xs font-medium text-[#4B5563] hover:bg-[#E5E7EB]" href={`/${locale}/kanji`}>
          漢 Kanji →
        </Link>
      </nav>
    </div>
  );
}
