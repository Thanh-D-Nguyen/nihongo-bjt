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
  strokeCount: string;
  onyomi: string;
  kunyomi: string;
}

export function KanjiClient({ labels, locale }: { labels: Labels; locale: string }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<KanjiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ limit: "40" });
      if (q) params.set("q", q);
      const res = await learnerApiFetchOptional(`/api/content/kanji?${params}`);
      if (res.ok) setItems(await res.json());
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(query), 300);
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
      )}
    </div>
  );
}
