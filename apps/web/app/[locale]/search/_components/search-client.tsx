"use client";

import type { SearchResult } from "@nihongo-bjt/shared";
import { Card, CardContent, EmptyState, PageHeader, SkillChip, cn } from "@nihongo-bjt/ui";
import { FormEvent, useEffect, useMemo, useState } from "react";

interface SearchLabels {
  empty: string;
  error: string;
  eyebrow: string;
  inputLabel: string;
  kindExample: string;
  kindGrammar: string;
  kindKanji: string;
  kindLexeme: string;
  loading: string;
  placeholder: string;
  submit: string;
  subtitle: string;
  title: string;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const kinds = ["lexeme", "kanji", "grammar", "example"] as const;
type KindFilter = "all" | (typeof kinds)[number];

export function SearchClient({ labels }: { labels: SearchLabels }) {
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<KindFilter>("all");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  async function runSearch(rawQuery: string) {
    const q = rawQuery.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setError(false);
    setLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/search?q=${encodeURIComponent(q)}&limit=20`);
      if (!response.ok) {
        throw new Error("Search request failed");
      }

      const data = (await response.json()) as SearchResult[];
      setResults(data);
      void fetch(`${apiBaseUrl}/api/analytics/events`, {
        body: JSON.stringify({
          eventName: "content_search_submitted",
          payload: { query: q, resultCount: data.length },
          source: "learner_web"
        }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSearch(query);
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q") ?? "";
    if (q) {
      setQuery(q);
      void runSearch(q);
    }
  }, []);

  const visibleResults = useMemo(
    () => (filter === "all" ? results : results.filter((result) => result.kind === filter)),
    [filter, results]
  );

  return (
    <main className="w-full space-y-6 pb-12">
      <PageHeader
        actions={
          <form
            className="flex w-full max-w-lg flex-col gap-2 sm:flex-row sm:items-center"
            onSubmit={onSubmit}
          >
            <label className="sr-only" htmlFor="content-search">
              {labels.inputLabel}
            </label>
            <input
              className="min-w-0 flex-1 rounded-xl border border-ink/12 bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted"
              id="content-search"
              minLength={1}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={labels.placeholder}
              required
              type="search"
              value={query}
            />
            <button
              className="rounded-xl border border-ink/15 bg-ink px-4 py-2 text-sm font-semibold text-surface hover:bg-ink/90 disabled:opacity-50"
              disabled={loading}
              type="submit"
            >
              {labels.submit}
            </button>
          </form>
        }
        description={labels.subtitle}
        eyebrow={labels.eyebrow}
        title={labels.title}
      />
      <Card className="border-ink/10 shadow-sm">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </FilterButton>
            {kinds.map((kind) => (
              <FilterButton active={filter === kind} key={kind} onClick={() => setFilter(kind)}>
                {kindLabel(kind, labels)}
              </FilterButton>
            ))}
          </div>
          {loading ? <p className="text-sm text-muted">{labels.loading}</p> : null}
          {error ? (
            <p className="text-sm text-sakura" role="alert">
              {labels.error}
            </p>
          ) : null}
          {!loading && !error && results.length === 0 ? (
            <EmptyState className="py-8" description={labels.subtitle} title={labels.empty} />
          ) : null}
          {!loading && !error && results.length > 0 && visibleResults.length === 0 ? (
            <p className="text-sm text-muted">{labels.empty}</p>
          ) : null}
          <ul className="grid list-none gap-3 p-0 lg:grid-cols-2">
            {visibleResults.map((result) => (
              <li
                className="rounded-xl border border-ink/10 bg-paper/50 p-4 transition hover:border-accent/25 hover:bg-surface"
                key={`${result.kind}:${result.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <SkillChip className="mb-2">{kindLabel(result.kind, labels)}</SkillChip>
                  <span className="text-xs font-semibold text-accent">+ SRS</span>
                </div>
                <strong className="jp-text block text-base font-semibold text-ink">
                  {result.title}
                </strong>
                {result.reading ? <small className="text-muted">{result.reading}</small> : null}
                {result.description ? (
                  <p className="mt-2 line-clamp-3 text-sm text-muted">{result.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

function FilterButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-lg border px-3 py-1.5 text-xs font-semibold",
        active
          ? "border-accent bg-accent text-surface"
          : "border-ink/10 bg-paper text-muted hover:text-ink"
      )}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function kindLabel(kind: SearchResult["kind"], labels: SearchLabels) {
  switch (kind) {
    case "example":
      return labels.kindExample;
    case "grammar":
      return labels.kindGrammar;
    case "kanji":
      return labels.kindKanji;
    case "lexeme":
      return labels.kindLexeme;
  }
}
