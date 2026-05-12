"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { learnerApiFetchOptional } from "../../../../lib/learner-api";

interface LexemeItem {
  id: string;
  headword: string;
  reading: string | null;
  jlptLevel: string | null;
  shortMeaningVi: string | null;
  senses: Array<{ id: string; meaningVi: string | null; partOfSpeech: string | null }>;
}

interface Labels {
  title: string;
  searchPlaceholder: string;
  noResults: string;
  loading: string;
  error: string;
  level: string;
  loadMore?: string;
  senses: string;
}

const PAGE_SIZE = 30;

export function DictionaryClient({ labels, locale }: { labels: Labels; locale: string }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LexemeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (q: string, nextOffset: number, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(nextOffset) });
      if (q) params.set("q", q);
      const res = await learnerApiFetchOptional(`/api/content/lexemes?${params}`);
      if (res.ok) {
        const data: LexemeItem[] = await res.json();
        setItems((prev) => append ? [...prev, ...data] : data);
        setHasMore(data.length === PAGE_SIZE);
        setOffset(nextOffset);
      } else setError(true);
    } catch {
      setError(true);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(query, 0, false), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold text-[#111827]">{labels.title}</h1>
      <input
        autoFocus
        className="mt-4 w-full rounded-xl border border-[#D1D5DB] px-4 py-3 text-sm outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
        onChange={(e) => setQuery(e.target.value)}
        placeholder={labels.searchPlaceholder}
        type="search"
        value={query}
      />

      {loading ? (
        <div className="mt-8 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div className="h-20 animate-pulse rounded-xl bg-[#F3F4F6]" key={i} />
          ))}
        </div>
      ) : error ? (
        <p className="mt-8 text-center text-sm text-red-500">{labels.error}</p>
      ) : items.length === 0 ? (
        <div className="mt-8 flex flex-col items-center py-8">
          <p className="text-sm text-[#6B7280]">{labels.noResults}</p>
          {query ? (
            <p className="mt-2 text-xs text-[#9CA3AF]">
              Thử tìm bằng hiragana, kanji hoặc tiếng Việt
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="mt-5 space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  className="block rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm transition-all hover:border-[#3B82F6]/30 hover:shadow-md"
                  href={`/${locale}/dictionary/${item.id}`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-semibold text-[#111827]">{item.headword}</span>
                    {item.reading ? (
                      <span className="text-sm text-[#6B7280]">{item.reading}</span>
                    ) : null}
                    {item.jlptLevel ? (
                      <span className="ml-auto rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-semibold text-[#1D4ED8]">
                        {item.jlptLevel}
                      </span>
                    ) : null}
                  </div>
                  {item.senses.length > 0 ? (
                    <p className="mt-1 text-sm text-[#4B5563]">
                      {item.senses
                        .slice(0, 3)
                        .map((s, i) => `${i + 1}. ${s.meaningVi ?? ""}`)
                        .join(" ")}
                    </p>
                  ) : item.shortMeaningVi ? (
                    <p className="mt-1 text-sm text-[#4B5563]">{item.shortMeaningVi}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          {hasMore ? (
            <button
              className="mt-4 w-full rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 text-sm font-semibold text-[#374151] transition-colors hover:border-[#3B82F6] hover:text-[#1D4ED8] disabled:opacity-60"
              disabled={loadingMore}
              onClick={() => void load(query, offset + PAGE_SIZE, true)}
              type="button"
            >
              {loadingMore ? labels.loading : labels.loadMore ?? "Tải thêm"}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
