"use client";

import { useRouter } from "next/navigation";

import { useRecentSearches } from "../../../../../lib/use-recent-searches";

interface HistoryLabels {
  title: string;
  empty: string;
  clearAll: string;
  searchAgain: string;
  remove: string;
}

export function SearchHistoryClient({ labels, locale }: { labels: HistoryLabels; locale: string }) {
  const router = useRouter();
  const { searches, removeSearch, clearAll } = useRecentSearches();

  return (
    <main className="w-full space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">{labels.title}</h1>
        {searches.length > 0 && (
          <button
            type="button"
            className="text-xs text-sakura hover:text-sakura/80 transition-colors"
            onClick={clearAll}
          >
            {labels.clearAll}
          </button>
        )}
      </div>
      {searches.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">{labels.empty}</p>
      ) : (
        <ul className="space-y-1">
          {searches.map((term: string) => (
            <li
              key={term}
              className="group flex items-center gap-3 rounded-lg border border-ink/6 bg-surface px-4 py-3 transition hover:border-accent/20"
            >
              <ClockIcon />
              <button
                type="button"
                className="flex-1 text-left text-sm font-medium text-ink hover:text-accent transition-colors"
                onClick={() => router.push(`/${locale}/search?q=${encodeURIComponent(term)}`)}
              >
                {term}
              </button>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 text-xs text-muted hover:text-sakura transition-all"
                onClick={() => removeSearch(term)}
                title={labels.remove}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function ClockIcon() {
  return (
    <svg className="shrink-0 text-muted/40" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
