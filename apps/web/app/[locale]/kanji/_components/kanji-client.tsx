"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { learnerApiFetchOptional } from "../../../../lib/learner-api";

interface KanjiItem {
  id: string;
  character: string;
  meaningVi: string | null;
  onyomi: string | null;
  kunyomi: string | null;
  level: number | null;
  strokeCount: number | null;
}

interface Labels {
  title: string;
  searchPlaceholder: string;
  noResults: string;
  loading: string;
  error: string;
  loadMore?: string;
  strokeCount: string;
  onyomi: string;
  kunyomi: string;
}

const PAGE_SIZE = 40;

export function KanjiClient({ labels, locale }: { labels: Labels; locale: string }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<KanjiItem[]>([]);
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
      const res = await learnerApiFetchOptional(`/api/content/kanji?${params}`);
      if (res.ok) {
        const data: KanjiItem[] = await res.json();
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
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
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
        <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div className="h-28 animate-pulse rounded-xl bg-[#F3F4F6]" key={i} />
          ))}
        </div>
      ) : error ? (
        <p className="mt-8 text-center text-sm text-red-500">{labels.error}</p>
      ) : items.length === 0 ? (
        <div className="mt-8 flex flex-col items-center py-8">
          <p className="text-sm text-[#6B7280]">{labels.noResults}</p>
          {query ? (
            <p className="mt-2 text-xs text-[#9CA3AF]">
              Thử tìm bằng kanji, âm On/Kun hoặc nghĩa
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {items.map((item) => (
              <Link
                className="flex flex-col items-center rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm transition-all hover:border-[#3B82F6]/30 hover:shadow-md"
                href={`/${locale}/kanji/${item.id}`}
                key={item.id}
              >
                <span className="text-3xl font-bold text-[#111827]">{item.character}</span>
                <span className="mt-1 truncate text-xs text-[#4B5563]">{item.meaningVi}</span>
                <div className="mt-1 flex gap-1 text-[10px] text-[#9CA3AF]">
                  {item.onyomi ? <span>{item.onyomi}</span> : null}
                  {item.kunyomi ? <span>· {item.kunyomi}</span> : null}
                </div>
                {item.level != null ? (
                  <span className="mt-1 rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[9px] font-semibold text-[#6B7280]">
                    N{item.level}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
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
