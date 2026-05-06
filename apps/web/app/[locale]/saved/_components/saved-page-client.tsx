"use client";

import { cn } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";
import { normalizeKanjiDetailDto } from "../../search/_components/kanji-detail-dto";

export interface SavedPageLabels {
  title: string;
  subtitle: string;
  loading: string;
  error: string;
  retry: string;
  emptyWords: string;
  emptyKanji: string;
  emptyGrammar: string;
  tabsRegionLabel: string;
  tabWords: string;
  tabKanji: string;
  tabGrammar: string;
  signInTitle: string;
  signInBody: string;
  signInCta: string;
  openInSearch: string;
  savedOnLabel: string;
  resolvingTitle: string;
  unknownTitle: string;
  /** Single-char fallback `q` when opening search before title resolves (broad corpus match) */
  searchFallbackQuery: string;
}

type SavedTab = "words" | "kanji" | "grammar";

type BookmarkRow = {
  id: string;
  targetId: string;
  targetType: string;
  createdAt: string;
  userId: string;
};

type BookmarkListResponse = {
  items: BookmarkRow[];
  limit: number;
  type: string;
};

function tabToListPath(tab: SavedTab): "/api/bookmarks/words" | "/api/bookmarks/kanji" | "/api/bookmarks/grammar" {
  if (tab === "words") return "/api/bookmarks/words";
  if (tab === "kanji") return "/api/bookmarks/kanji";
  return "/api/bookmarks/grammar";
}

function searchKindFromTargetType(targetType: string): "lexeme" | "kanji" | "grammar" {
  if (targetType === "kanji") return "kanji";
  if (targetType === "grammar") return "grammar";
  return "lexeme";
}

function searchHref(locale: string, title: string, targetType: string, targetId: string, fallbackQuery: string): string {
  const kind = searchKindFromTargetType(targetType);
  const q = (title.trim() || fallbackQuery).trim() || fallbackQuery;
  const params = new URLSearchParams({
    entry: `${kind}:${targetId}`,
    q
  });
  return `/${locale}/search?${params.toString()}`;
}

async function resolveBookmarkTitle(targetType: string, targetId: string): Promise<string | null> {
  try {
    if (targetType === "lexeme" || targetType === "word") {
      const r = await learnerApiFetch(`/api/dictionary/words/${encodeURIComponent(targetId)}`);
      if (!r.ok) return null;
      const data = (await r.json()) as { headword?: string };
      return data.headword?.trim() || null;
    }
    if (targetType === "kanji") {
      const r = await learnerApiFetch(`/api/kanji/${encodeURIComponent(targetId)}`);
      if (!r.ok) return null;
      const data = await r.json();
      const dto = normalizeKanjiDetailDto(data);
      return dto.character?.trim() || null;
    }
    if (targetType === "grammar") {
      const r = await learnerApiFetch(`/api/grammar/${encodeURIComponent(targetId)}`);
      if (!r.ok) return null;
      const data = (await r.json()) as { pattern?: string };
      return data.pattern?.trim() || null;
    }
  } catch {
    return null;
  }
  return null;
}

export function SavedPageClient({ labels, locale }: { labels: SavedPageLabels; locale: string }) {
  const { userId } = useKeycloakAuth();
  const [tab, setTab] = useState<SavedTab>("words");
  const [rows, setRows] = useState<BookmarkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  /** `null` = resolving, `""` = failed, string = label */
  const [titles, setTitles] = useState<Record<string, string | null>>({});
  const titleKey = (r: BookmarkRow) => `${r.targetType}:${r.targetId}`;

  const emptyLabel = useMemo(() => {
    if (tab === "kanji") return labels.emptyKanji;
    if (tab === "grammar") return labels.emptyGrammar;
    return labels.emptyWords;
  }, [tab, labels.emptyGrammar, labels.emptyKanji, labels.emptyWords]);

  const loadList = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(false);
    try {
      const path = tabToListPath(tab);
      const qs = new URLSearchParams({ limit: "50", userId });
      const r = await learnerApiFetch(`${path}?${qs.toString()}`);
      if (!r.ok) {
        setError(true);
        setRows([]);
        return;
      }
      const data = (await r.json()) as BookmarkListResponse;
      setRows(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError(true);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, userId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!userId || rows.length === 0) {
      setTitles({});
      return;
    }
    const initial: Record<string, string | null> = {};
    for (const r of rows) initial[titleKey(r)] = null;
    setTitles(initial);
    let cancelled = false;
    for (const row of rows) {
      const key = titleKey(row);
      void resolveBookmarkTitle(row.targetType, row.targetId).then((t) => {
        if (cancelled) return;
        setTitles((prev) => ({ ...prev, [key]: t ?? "" }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [rows, userId]);

  const formatSavedDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(locale === "ja" ? "ja-JP" : "vi-VN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch {
      return "";
    }
  };

  if (!userId) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="text-xl font-bold text-ink">{labels.signInTitle}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{labels.signInBody}</p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-semibold text-surface shadow-sm transition-colors hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
          href={`/${locale}/login`}
        >
          {labels.signInCta}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8 sm:px-0 sm:pb-16">
      <header className="border-b border-ink/10 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{labels.title}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{labels.subtitle}</p>
      </header>

      <div
        aria-label={labels.tabsRegionLabel}
        className="mt-6 flex flex-wrap gap-2"
        role="tablist"
      >
        {(
          [
            ["words", labels.tabWords] as const,
            ["kanji", labels.tabKanji] as const,
            ["grammar", labels.tabGrammar] as const
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-selected={tab === id}
            className={cn(
              "min-h-10 rounded-full border px-4 py-2 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35",
              tab === id
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-ink/10 bg-surface text-muted hover:border-ink/15 hover:text-ink"
            )}
            role="tab"
            type="button"
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-10 text-sm text-muted" role="status">
          {labels.loading}
        </p>
      ) : null}

      {error ? (
        <div className="mt-10 rounded-xl border border-sakura/20 bg-sakura/5 p-4">
          <p className="text-sm text-sakura" role="alert">
            {labels.error}
          </p>
          <button
            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg border border-ink/12 bg-paper px-3 text-xs font-semibold text-ink hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
            type="button"
            onClick={() => void loadList()}
          >
            {labels.retry}
          </button>
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <p className="mt-10 text-sm text-muted">{emptyLabel}</p>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <ul className="mt-8 divide-y divide-ink/8 rounded-2xl border border-ink/10 bg-surface shadow-sm">
          {rows.map((row) => {
            const key = titleKey(row);
            const raw = titles[key];
            const resolved =
              raw === undefined || raw === null ? "resolving" : raw === "" ? "unknown" : "ok";
            const primary =
              resolved === "resolving"
                ? labels.resolvingTitle
                : resolved === "unknown"
                  ? labels.unknownTitle
                  : raw;
            const qTitle = resolved === "ok" && raw != null ? raw : "";
            const href = searchHref(locale, qTitle, row.targetType, row.targetId, labels.searchFallbackQuery);
            const dateStr = formatSavedDate(row.createdAt);
            return (
              <li className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between" key={row.id}>
                <div className="min-w-0">
                  <p className="jp-text truncate text-base font-semibold text-ink">{primary}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {labels.savedOnLabel.replace("{date}", dateStr || "—")}
                  </p>
                </div>
                <Link
                  className="inline-flex shrink-0 min-h-10 items-center justify-center self-start rounded-xl border border-ink/12 bg-paper px-4 text-xs font-bold text-ink hover:bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:self-center"
                  href={href}
                >
                  {labels.openInSearch}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </main>
  );
}
