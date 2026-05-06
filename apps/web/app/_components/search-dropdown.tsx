"use client";

import { cn } from "@nihongo-bjt/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useRecentSearches } from "../../lib/use-recent-searches";

export interface SearchDropdownLabels {
  recentTitle: string;
  clearRecent: string;
  suggestionsTitle: string;
  seeAll: string;
  noSuggestions: string;
  kindLexeme: string;
  kindKanji: string;
  kindGrammar: string;
  kindExample: string;
}

interface Suggestion {
  id: string;
  kind: "lexeme" | "kanji" | "grammar" | "example";
  reading: string | null;
  title: string;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const kindColors: Record<string, string> = {
  lexeme: "bg-accent/10 text-accent",
  kanji: "bg-sakura/10 text-sakura",
  grammar: "bg-amber-100 text-amber-700",
  example: "bg-sky-100 text-sky-700"
};

function kindLabel(kind: string, labels: SearchDropdownLabels): string {
  const map: Record<string, string> = {
    lexeme: labels.kindLexeme,
    kanji: labels.kindKanji,
    grammar: labels.kindGrammar,
    example: labels.kindExample
  };
  return map[kind] ?? kind;
}

/**
 * Call from the parent input's onKeyDown handler.
 * Returns true if the event was consumed (ArrowUp/Down/Enter on highlighted item).
 */
export type DropdownKeyHandler = (e: React.KeyboardEvent<HTMLInputElement>) => boolean;

export function SearchDropdown({
  query,
  open,
  onClose,
  onSelect,
  locale,
  labels,
  onKeyHandlerReady
}: {
  query: string;
  open: boolean;
  onClose: () => void;
  onSelect: (q: string) => void;
  locale: string;
  labels: SearchDropdownLabels;
  /** Called once to register the keyboard handler the parent should use */
  onKeyHandlerReady: (handler: DropdownKeyHandler) => void;
}) {
  const router = useRouter();
  const { searches: recentSearches, addSearch, clearAll } = useRecentSearches();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stateRef = useRef({ highlightIndex: -1, allItems: [] as Item[] });

  type Item = { type: "recent" | "suggestion" | "seeAll"; value: string; suggestion?: Suggestion };

  // Fetch suggestions on query change
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiBaseUrl}/api/search/suggest?q=${encodeURIComponent(q)}&limit=6`);
        if (res.ok) {
          const data = (await res.json()) as Suggestion[];
          setSuggestions(data);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(debounceRef.current);
  }, [query, open]);

  // Reset highlight on query change
  useEffect(() => {
    setHighlightIndex(-1);
  }, [query]);

  // Build items list for keyboard nav
  const allItems: Item[] = [];
  const trimmedQuery = query.trim();

  if (!trimmedQuery && recentSearches.length > 0) {
    for (const r of recentSearches.slice(0, 5)) {
      allItems.push({ type: "recent", value: r });
    }
  }

  if (trimmedQuery) {
    for (const s of suggestions) {
      allItems.push({ type: "suggestion", value: s.title, suggestion: s });
    }
    allItems.push({ type: "seeAll", value: trimmedQuery });
  }

  // Keep ref in sync
  stateRef.current.highlightIndex = highlightIndex;
  stateRef.current.allItems = allItems;

  const doSelect = useCallback((item: Item) => {
    addSearch(item.value);
    if (item.type === "seeAll" || item.type === "recent") {
      onSelect(item.value);
      router.push(`/${locale}/search?q=${encodeURIComponent(item.value)}`);
    } else if (item.suggestion) {
      onSelect(item.suggestion.title);
      router.push(`/${locale}/search?q=${encodeURIComponent(item.suggestion.title)}`);
    }
    onClose();
  }, [addSearch, locale, onClose, onSelect, router]);

  // Register keyboard handler for parent input
  useEffect(() => {
    const handler: DropdownKeyHandler = (e) => {
      const { allItems: items, highlightIndex: hi } = stateRef.current;
      if (items.length === 0) return false;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
        return true;
      }
      if (e.key === "Enter" && hi >= 0 && hi < items.length) {
        e.preventDefault();
        doSelect(items[hi]!);
        return true;
      }
      if (e.key === "Escape") {
        onClose();
        return true;
      }
      return false;
    };
    onKeyHandlerReady(handler);
  }, [doSelect, onClose, onKeyHandlerReady]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        const form = dropdownRef.current.closest("form");
        if (form && form.contains(e.target as Node)) return;
        onClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handleClick), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute left-0 right-0 top-full mt-1 z-50 overflow-hidden border border-ink/10 bg-surface shadow-lg animate-in fade-in slide-in-from-top-1 duration-150"
      style={{ borderRadius: "8px" }}
    >
      <div className="max-h-[360px] overflow-y-auto">
        {/* Recent searches (shown when input is empty) */}
        {!trimmedQuery && recentSearches.length > 0 && (
          <div className="px-3 pt-3 pb-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted/60">
                {labels.recentTitle}
              </span>
              <button
                type="button"
                className="text-[10px] text-muted/50 hover:text-sakura transition-colors"
                onClick={(e) => { e.stopPropagation(); clearAll(); }}
              >
                {labels.clearRecent}
              </button>
            </div>
            {recentSearches.slice(0, 5).map((term, i) => (
              <button
                key={term}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm transition-colors",
                  highlightIndex === i ? "bg-accent/8 text-accent" : "text-ink/80 hover:bg-ink/4"
                )}
                onClick={() => doSelect({ type: "recent", value: term })}
              >
                <ClockIcon />
                <span className="truncate">{term}</span>
              </button>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {trimmedQuery && (
          <div className="px-3 pt-3 pb-1">
            {suggestions.length > 0 && (
              <>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted/60 mb-1.5 block">
                  {labels.suggestionsTitle}
                </span>
                {suggestions.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left transition-colors",
                      highlightIndex === i ? "bg-accent/8" : "hover:bg-ink/4"
                    )}
                    onClick={() => doSelect({ type: "suggestion", value: s.title, suggestion: s })}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-ink truncate">{s.title}</span>
                      {s.reading && (
                        <span className="block text-xs text-muted/60 truncate">{s.reading}</span>
                      )}
                    </span>
                    <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium", kindColors[s.kind])}>
                      {kindLabel(s.kind, labels)}
                    </span>
                  </button>
                ))}
              </>
            )}
            {!loading && suggestions.length === 0 && (
              <p className="py-3 text-center text-xs text-muted/50">{labels.noSuggestions}</p>
            )}
            {loading && (
              <div className="flex justify-center py-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
              </div>
            )}
          </div>
        )}

        {/* See all results footer */}
        {trimmedQuery && (
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2 border-t border-ink/6 px-3 py-2.5 text-sm transition-colors",
              highlightIndex === allItems.length - 1 ? "bg-accent/8 text-accent" : "text-muted hover:bg-ink/4 hover:text-ink"
            )}
            onClick={() => doSelect({ type: "seeAll", value: trimmedQuery })}
          >
            <SearchIcon />
            <span>
              {labels.seeAll} <strong className="text-ink">「{trimmedQuery}」</strong>
            </span>
            <span className="ml-auto text-xs text-muted/40">↵</span>
          </button>
        )}

        {/* Empty state */}
        {!trimmedQuery && recentSearches.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-muted/50">
            {labels.noSuggestions}
          </p>
        )}
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg className="shrink-0 text-muted/40" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
