"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { learnerApiFetchOptional } from "../../../../lib/learner-api";

interface GrammarItem {
  id: string;
  pattern: string;
  meaningVi: string | null;
  jlptLevel: string | null;
  category: string | null;
  details: Array<{ id: string; meaningVi: string | null; position: number }>;
}

interface Labels {
  title: string;
  searchPlaceholder: string;
  noResults: string;
  loading: string;
  error: string;
  loadMore?: string;
  level: string;
}

const PAGE_SIZE = 30;
const SUGGESTED_PATTERNS = ["について", "に関して", "にもかかわらず", "させていただく"] as const;

export function GrammarClient({ labels, locale }: { labels: Labels; locale: string }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GrammarItem[]>([]);
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
      const res = await learnerApiFetchOptional(`/api/content/grammar?${params}`);
      if (res.ok) {
        const data: GrammarItem[] = await res.json();
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

  const visibleItems = items.filter(
    (it) => !it.pattern.startsWith("~audit") && it.meaningVi !== "fixture"
  );
  const scopeTabs = [
    { href: `/${locale}/dictionary`, label: locale === "ja" ? "辞書" : locale === "en" ? "Dictionary" : "Từ điển", active: false },
    { href: `/${locale}/kanji`, label: "Kanji", active: false },
    { href: `/${locale}/grammar`, label: locale === "ja" ? "文法" : locale === "en" ? "Grammar" : "Ngữ pháp", active: true },
    { href: `/${locale}/saved`, label: locale === "ja" ? "保存済み" : locale === "en" ? "Saved" : "Đã lưu", active: false },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">{labels.title}</h1>
        <nav aria-label="Reference scope" className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
          {scopeTabs.map((tab) => (
            <Link
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab.active
                  ? "bg-ink text-surface"
                  : "text-muted hover:bg-surface-subtle hover:text-ink"
              }`}
              href={tab.href}
              key={tab.href}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      <input
        autoFocus
        className="mt-4 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
        onChange={(e) => setQuery(e.target.value)}
        placeholder={labels.searchPlaceholder}
        type="search"
        value={query}
      />

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {SUGGESTED_PATTERNS.map((chip) => (
          <button
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              query === chip
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-surface text-muted hover:border-accent/40 hover:text-ink"
            }`}
            key={chip}
            onClick={() => setQuery(query === chip ? "" : chip)}
            type="button"
          >
            <span className="jp-text" lang="ja">{chip}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div className="h-16 animate-pulse rounded-xl bg-surface-subtle" key={i} />
          ))}
        </div>
      ) : error ? (
        <p className="mt-8 text-center text-sm text-danger">{labels.error}</p>
      ) : visibleItems.length === 0 ? (
        <div className="mt-8 flex flex-col items-center py-8">
          <p className="text-sm text-muted">{labels.noResults}</p>
          {query ? (
            <p className="mt-2 text-xs text-muted">
              Thử tìm bằng mẫu ngữ pháp hoặc nghĩa tiếng Việt
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="mt-5 space-y-2">
            {visibleItems.map((item) => (
              <li key={item.id}>
                <Link
                  className="block rounded-xl border border-border bg-surface px-4 py-3 shadow-sm transition-colors hover:border-accent/40 hover:bg-surface-subtle"
                  href={`/${locale}/grammar/${item.id}`}
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="jp-text text-base font-bold text-ink" lang="ja">{item.pattern}</span>
                    {item.jlptLevel ? (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                        {item.jlptLevel}
                      </span>
                    ) : null}
                    {item.category ? (
                      <span className="text-[10px] text-muted">{item.category}</span>
                    ) : null}
                  </div>
                  {item.meaningVi ? (
                    <p className="mt-1 text-sm text-muted">{item.meaningVi}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          {hasMore ? (
            <button
              className="mt-4 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink transition-colors hover:border-accent/40 hover:bg-surface-subtle disabled:opacity-60"
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
