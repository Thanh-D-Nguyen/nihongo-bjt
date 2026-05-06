"use client";

import type { SearchResult } from "@nihongo-bjt/shared";
import { cn } from "@nihongo-bjt/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";

import { VoiceSearchButton } from "../../../_components/search-advanced-inputs";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import {
  type DetailPayload,
  normalizeKanjiDetailDto,
  SearchDetailPanel,
  type SearchDetailLabels
} from "./search-detail-panel";
import { HighlightMatch } from "./search-highlight";

export interface SearchLabels extends SearchDetailLabels {
  empty: string;
  error: string;
  /** Primary action when index search fails (network / 5xx) */
  retrySearch: string;
  eyebrow: string;
  inputLabel: string;
  kindAll: string;
  kindExample: string;
  kindGrammar: string;
  kindKanji: string;
  kindLexeme: string;
  loading: string;
  placeholder: string;
  submit: string;
  subtitle: string;
  title: string;
  resultCount?: string;
  /** Visible + SR summary when results exist, e.g. "{count} … “{query}”" */
  resultsForQueryLabel: string;
  exampleChips: string[];
  exampleChipsAriaLabel: string;
  /** Shown when API returned hits but the active kind/level filter hides every row */
  noResultsInFilter: string;
  /** Decorative kanji on empty search landing (visual only; paired with aria-hidden) */
  landingHeroGlyph: string;
  /** aria-label for kind filter pill row */
  kindFiltersAriaLabel: string;
  /** aria-label for JLPT level chip row */
  jlptLevelFiltersAriaLabel: string;
  recentTitle?: string;
  noSuggestions?: string;
  /** Desktop: visible heading above results list */
  resultsHeading: string;
  /** Desktop: visible heading above detail column */
  detailHeading: string;
  /** a11y region label for results list */
  resultsRegionLabel: string;
  /** a11y region label for detail column */
  detailRegionLabel: string;
  /** Mobile sticky CTA to open bottom sheet */
  openDetail: string;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const kinds = ["lexeme", "kanji", "grammar", "example"] as const;
type KindFilter = "all" | (typeof kinds)[number];
const levels = ["N1", "N2", "N3", "N4", "N5"] as const;

const kindConfig: Record<string, { border: string; icon: string; bg: string }> = {
  lexeme: { border: "border-l-accent", icon: "文", bg: "bg-accent/8 text-accent" },
  kanji: { border: "border-l-sakura", icon: "漢", bg: "bg-sakura/8 text-sakura" },
  grammar: { border: "border-l-leaf", icon: "法", bg: "bg-leaf/8 text-leaf" },
  example: { border: "border-l-amber-400", icon: "例", bg: "bg-amber-100 text-amber-700" }
};

function useIsMobileMd(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return mobile;
}

function entryKeyFromUrl(raw: string | null): { id: string; kind: SearchResult["kind"] } | null {
  if (!raw) return null;
  const idx = raw.indexOf(":");
  if (idx < 1) return null;
  const kind = raw.slice(0, idx) as SearchResult["kind"];
  const id = raw.slice(idx + 1);
  if (!id || !(kinds as readonly string[]).includes(kind)) return null;
  return { id, kind };
}

/** Tabbable descendants for dialog focus trap (sheet). */
function getFocusableElements(root: HTMLElement): HTMLElement[] {
  const sel =
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(sel)).filter((el) => {
    if (el.hasAttribute("disabled")) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    return true;
  });
}

function detailPathForKind(kind: SearchResult["kind"], id: string): string | null {
  switch (kind) {
    case "lexeme":
      return `/api/dictionary/words/${encodeURIComponent(id)}`;
    case "kanji":
      return `/api/kanji/${encodeURIComponent(id)}`;
    case "grammar":
      return `/api/grammar/${encodeURIComponent(id)}`;
    default:
      return null;
  }
}

export function SearchClient({ labels, locale }: { labels: SearchLabels; locale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { userId } = useKeycloakAuth();
  const sheetTitleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetPanelRef = useRef<HTMLDivElement>(null);
  const sheetReturnFocusRef = useRef<HTMLElement | null>(null);
  const prevDetailSheetOpenRef = useRef(false);
  const pendingEntryRef = useRef(entryKeyFromUrl(searchParams.get("entry")));
  const prevLoadingForAnnounceRef = useRef(false);
  /** Monotonic id so stale in-flight search responses cannot overwrite newer results */
  const searchEpochRef = useRef(0);

  /** q + scope + level only — entry changes must not re-fetch the whole index */
  const urlSearchBootstrapKey = useMemo(
    () =>
      [searchParams.get("q") ?? "", searchParams.get("scope") ?? "", searchParams.get("level") ?? ""].join("\u0001"),
    [searchParams]
  );
  const isMobile = useIsMobileMd();

  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [filter, setFilter] = useState<KindFilter>("all");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [hasSearched, setHasSearched] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);

  const runSearch = useCallback(async (rawQuery: string, scope?: string, level?: string) => {
    const q = rawQuery.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const epoch = ++searchEpochRef.current;
    setError(false);
    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({ q, limit: "20" });
      if (scope && scope !== "all") params.set("scope", scope);
      if (level) params.set("level", level);
      const response = await fetch(`${apiBaseUrl}/api/search?${params}`);
      if (!response.ok) {
        throw new Error("Search request failed");
      }
      const data = (await response.json()) as SearchResult[];
      if (epoch !== searchEpochRef.current) return;
      setResults(Array.isArray(data) ? data : []);
      void fetch(`${apiBaseUrl}/api/analytics/events`, {
        body: JSON.stringify({
          eventName: "content_search_submitted",
          payload: { query: q, resultCount: data.length, scope, level },
          source: "learner_web"
        }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });
    } catch {
      if (epoch !== searchEpochRef.current) return;
      setError(true);
    } finally {
      if (epoch === searchEpochRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const updateUrl = useCallback(
    (q: string, scope: KindFilter, level: string, entry?: string | null) => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (scope !== "all") params.set("scope", scope);
      if (level) params.set("level", level);
      if (entry) params.set("entry", entry);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  const selectedEntry = selected ? `${selected.kind}:${selected.id}` : null;

  useEffect(() => {
    if (!hasSearched) return;
    if (pendingEntryRef.current) return;
    const params = new URLSearchParams(searchParams.toString());
    const urlQ = (params.get("q") ?? "").trim();
    if (urlQ !== query.trim()) {
      return;
    }
    const cur = params.get("entry");
    if (cur === selectedEntry || (!cur && !selectedEntry)) {
      return;
    }
    if (selectedEntry) {
      params.set("entry", selectedEntry);
    } else {
      params.delete("entry");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [selectedEntry, hasSearched, query, pathname, router, searchParams]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    pendingEntryRef.current = null;
    setSelected(null);
    updateUrl(query, filter, levelFilter, null);
  }

  function handleFilterChange(newFilter: KindFilter) {
    setFilter(newFilter);
    if (query.trim()) {
      updateUrl(query, newFilter, levelFilter, null);
    }
  }

  function handleLevelChange(newLevel: string) {
    const level = newLevel === levelFilter ? "" : newLevel;
    setLevelFilter(level);
    if (query.trim()) {
      updateUrl(query, filter, level, null);
    }
  }

  function selectResult(r: SearchResult) {
    if (isMobile) {
      sheetReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    setSelected(r);
    if (isMobile) setDetailSheetOpen(true);
  }

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    const scope = searchParams.get("scope") ?? "";
    const level = searchParams.get("level") ?? "";

    if (scope && (kinds as readonly string[]).includes(scope)) {
      setFilter(scope as KindFilter);
    } else {
      setFilter("all");
    }

    if (level) {
      setLevelFilter(level);
    } else {
      setLevelFilter("");
    }

    pendingEntryRef.current = entryKeyFromUrl(searchParams.get("entry"));

    if (q.trim()) {
      setQuery(q);
      setSelected(null);
      setResults([]);
      void runSearch(q, scope || undefined, level || undefined);
    } else {
      searchEpochRef.current += 1;
      setQuery("");
      setResults([]);
      setHasSearched(false);
      setSelected(null);
      inputRef.current?.focus();
    }
    // Intentionally only `urlSearchBootstrapKey` + runSearch: `searchParams` identity changes when
    // only `entry` is patched would otherwise re-run this effect and double-fetch / fight selection.
  }, [urlSearchBootstrapKey, runSearch]);

  const visibleResults = useMemo(
    () => (filter === "all" ? results : results.filter((r) => r.kind === filter)),
    [filter, results]
  );

  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of results) counts[r.kind] = (counts[r.kind] ?? 0) + 1;
    return counts;
  }, [results]);

  useEffect(() => {
    if (visibleResults.length === 0) {
      setSelected(null);
      return;
    }
    const fromUrl = pendingEntryRef.current;
    if (fromUrl) {
      const hit = visibleResults.find((r) => r.kind === fromUrl.kind && r.id === fromUrl.id);
      pendingEntryRef.current = null;
      if (hit) {
        setSelected(hit);
        return;
      }
    }
    setSelected((prev) => {
      if (prev && visibleResults.some((r) => r.id === prev.id && r.kind === prev.kind)) {
        return prev;
      }
      return visibleResults[0];
    });
  }, [visibleResults]);

  useEffect(() => {
    if (!isMobile) setDetailSheetOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (selected && !isMobile) setDetailSheetOpen(false);
  }, [selected, isMobile]);

  useEffect(() => {
    if (!selected) setDetailSheetOpen(false);
  }, [selected]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    const path = detailPathForKind(selected.kind, selected.id);
    if (!path) {
      setDetail({ data: null, kind: "example" });
      setDetailLoading(false);
      setDetailError(false);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(false);
    setDetail(null);

    void (async () => {
      try {
        const response = await fetch(`${apiBaseUrl}${path}`);
        if (!response.ok) {
          throw new Error("detail failed");
        }
        const data = await response.json();
        if (cancelled) return;
        if (selected.kind === "lexeme") {
          setDetail({ data, kind: "lexeme" });
        } else if (selected.kind === "kanji") {
          setDetail({ data: normalizeKanjiDetailDto(data), kind: "kanji" });
        } else {
          setDetail({ data, kind: "grammar" });
        }
      } catch {
        if (!cancelled) setDetailError(true);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selected]);

  const showMobileDetailBar =
    isMobile && selected && !detailSheetOpen && hasSearched && visibleResults.length > 0 && !loading && !error;

  /** Keep page chrome out of tab order / pointer while modal sheet is open (mobile). */
  const searchBodyInert = isMobile && detailSheetOpen;

  const searchStatusAnnouncementRaw = useMemo(() => {
    if (loading && hasSearched) return labels.loading;
    if (error) return labels.error;
    if (!hasSearched) return "";
    if (!loading && !error && hasSearched && results.length === 0) {
      return labels.empty;
    }
    if (!loading && !error && hasSearched && results.length > 0 && visibleResults.length === 0) {
      return labels.noResultsInFilter;
    }
    if (!loading && !error && hasSearched && visibleResults.length > 0) {
      return labels.resultsForQueryLabel
        .replace("{count}", String(visibleResults.length))
        .replace("{query}", query.trim());
    }
    return "";
  }, [
    error,
    hasSearched,
    labels.empty,
    labels.error,
    labels.loading,
    labels.noResultsInFilter,
    labels.resultsForQueryLabel,
    loading,
    query,
    results.length,
    visibleResults.length
  ]);

  const [searchStatusAnnouncement, setSearchStatusAnnouncement] = useState("");

  useEffect(() => {
    if (error || (loading && hasSearched)) {
      setSearchStatusAnnouncement(searchStatusAnnouncementRaw);
      prevLoadingForAnnounceRef.current = loading;
      return;
    }
    if (!hasSearched) {
      setSearchStatusAnnouncement("");
      prevLoadingForAnnounceRef.current = loading;
      return;
    }
    const wasLoading = prevLoadingForAnnounceRef.current;
    prevLoadingForAnnounceRef.current = loading;
    const delay = wasLoading && !loading ? 0 : 420;
    const id = window.setTimeout(() => {
      setSearchStatusAnnouncement(searchStatusAnnouncementRaw);
    }, delay);
    return () => window.clearTimeout(id);
  }, [searchStatusAnnouncementRaw, error, loading, hasSearched]);

  useEffect(() => {
    if (!isMobile || !detailSheetOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isMobile, detailSheetOpen]);

  useEffect(() => {
    const wasOpen = prevDetailSheetOpenRef.current;
    prevDetailSheetOpenRef.current = detailSheetOpen;
    if (wasOpen && !detailSheetOpen) {
      const el = sheetReturnFocusRef.current;
      sheetReturnFocusRef.current = null;
      requestAnimationFrame(() => {
        el?.focus?.();
      });
    }
  }, [detailSheetOpen]);

  useEffect(() => {
    if (!detailSheetOpen) return;
    const root = sheetPanelRef.current;
    if (!root) return;

    const focusFirst = () => {
      const focusables = getFocusableElements(root);
      (focusables[0] ?? root).focus();
    };

    const onKey = (ev: globalThis.KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        setDetailSheetOpen(false);
        return;
      }
      if (ev.key !== "Tab") return;
      const focusables = getFocusableElements(root);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (ev.shiftKey) {
        if (document.activeElement === first) {
          ev.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(focusFirst);
    });
    return () => {
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
      document.removeEventListener("keydown", onKey);
    };
  }, [detailSheetOpen]);

  function handleResultsListKeyDown(e: ReactKeyboardEvent<HTMLElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const list = e.currentTarget.querySelector("ul");
    if (!list) return;
    const items = [...list.querySelectorAll<HTMLButtonElement>(":scope > li > button")];
    if (items.length === 0) return;
    const active = document.activeElement;
    const idx = items.indexOf(active as HTMLButtonElement);

    if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = idx < 0 ? 0 : Math.min(idx + 1, items.length - 1);
      items[next]?.focus();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = idx < 0 ? items.length - 1 : Math.max(idx - 1, 0);
      items[next]?.focus();
    }
  }

  return (
    <main
      className={cn(
        "mx-auto w-full max-w-6xl pb-24 md:pb-16",
        showMobileDetailBar && "pb-32"
      )}
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {searchStatusAnnouncement}
      </p>
      <div inert={searchBodyInert ? true : undefined}>
      <div
        className="sticky top-0 z-20 border-b border-ink/10 bg-paper/95 px-4 pb-2 pt-4 shadow-[0_6px_14px_-10px_rgba(0,0,0,0.08)] backdrop-blur-sm sm:px-0"
      >
        <form className="relative" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="content-search">
            {labels.inputLabel}
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                ref={inputRef}
                id="content-search"
                autoComplete="off"
                className="w-full min-h-11 appearance-none rounded-xl border border-ink/10 bg-surface py-3 pl-10 pr-4 text-base text-ink shadow-sm transition-all placeholder:text-muted/60 focus:border-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
                placeholder={labels.placeholder}
                style={{ WebkitAppearance: "none", appearance: "none" }}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <VoiceSearchButton
              className="shrink-0"
              onResult={(text) => {
                setQuery(text);
                pendingEntryRef.current = null;
                setSelected(null);
                updateUrl(text, filter, levelFilter, null);
              }}
            />
            <button
              className="shrink-0 min-h-11 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-surface shadow-sm transition-colors hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-40"
              disabled={loading || !query.trim()}
              type="submit"
            >
              {labels.submit}
            </button>
          </div>
        </form>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div
            aria-label={labels.kindFiltersAriaLabel}
            className="flex items-center gap-1.5 overflow-x-auto scrollbar-none"
            role="group"
          >
            <FilterPill
              active={filter === "all"}
              count={results.length}
              onClick={() => handleFilterChange("all")}
            >
              {labels.kindAll}
            </FilterPill>
            {kinds.map((kind) => (
              <FilterPill
                key={kind}
                active={filter === kind}
                count={kindCounts[kind] ?? 0}
                kind={kind}
                onClick={() => handleFilterChange(kind)}
              >
                {kindLabel(kind, labels)}
              </FilterPill>
            ))}
          </div>
          <div
            aria-label={labels.jlptLevelFiltersAriaLabel}
            className="flex flex-wrap items-center gap-1 sm:ml-auto"
            role="group"
          >
            {levels.map((lvl) => (
              <button
                key={lvl}
                className={cn(
                  "inline-flex min-h-10 min-w-10 items-center justify-center rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
                  levelFilter === lvl
                    ? "bg-accent text-surface shadow-sm"
                    : "text-muted hover:bg-ink/5 hover:text-ink"
                )}
                type="button"
                onClick={() => handleLevelChange(lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!loading && hasSearched && results.length > 0 && (
        <p className="mt-3 px-4 text-xs text-muted sm:px-0">
          {labels.resultsForQueryLabel
            .replace("{count}", String(visibleResults.length))
            .replace("{query}", query.trim())}
        </p>
      )}

      {loading && hasSearched && (
        <div className="mt-4 min-h-[min(52vh,28rem)] px-4 sm:px-0" aria-busy="true">
          <div className="mb-3 flex items-center justify-center gap-2">
            <div
              className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-accent/30 border-t-accent motion-reduce:animate-none"
              aria-hidden
            />
            <span className="text-sm text-muted">{labels.loading}</span>
          </div>
          <SearchResultsLoadingSkeleton />
        </div>
      )}

      {error && (
        <div className="mx-4 mt-8 rounded-xl border border-sakura/20 bg-sakura/5 p-4 text-center sm:mx-0">
          <p className="text-sm text-sakura" role="alert">
            {labels.error}
          </p>
          {query.trim() ? (
            <button
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-ink/12 bg-surface px-4 text-sm font-semibold text-ink shadow-sm transition-colors hover:border-ink/18 hover:bg-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
              type="button"
              onClick={() => {
                setError(false);
                void runSearch(
                  query.trim(),
                  filter === "all" ? undefined : filter,
                  levelFilter || undefined
                );
              }}
            >
              {labels.retrySearch}
            </button>
          ) : null}
        </div>
      )}

      {!loading && !error && hasSearched && results.length === 0 && (
        <div className="mt-16 flex flex-col items-center gap-3 px-4">
          <SearchIcon className="h-14 w-14 shrink-0 text-muted/30" aria-hidden />
          <p className="max-w-xs text-center text-sm text-muted">{labels.empty}</p>
        </div>
      )}

      {!loading && !error && hasSearched && results.length > 0 && visibleResults.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted">{labels.noResultsInFilter}</p>
      )}

      {!hasSearched && !loading && (
        <div className="mt-20 flex flex-col items-center gap-4 px-4 text-center">
          <span aria-hidden className="jp-text select-none text-5xl opacity-20">
            {labels.landingHeroGlyph}
          </span>
          <h2 className="text-lg font-bold text-ink">{labels.title}</h2>
          <p className="max-w-sm text-sm text-muted">{labels.subtitle}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2" role="group" aria-label={labels.exampleChipsAriaLabel}>
            {labels.exampleChips.map((example) => (
              <button
                key={example}
                className="min-h-10 rounded-full border border-ink/8 bg-surface px-3 py-2 text-xs text-muted transition-colors hover:border-ink/15 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                type="button"
                onClick={() => {
                  setQuery(example);
                  pendingEntryRef.current = null;
                  setSelected(null);
                  updateUrl(example, filter, levelFilter, null);
                }}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {!loading && !error && hasSearched && visibleResults.length > 0 && (
        <div className="mt-4 px-4 sm:px-0 lg:mt-6 lg:grid lg:grid-cols-[minmax(260px,min(100%,24rem))_minmax(0,1fr)] lg:items-start lg:gap-8">
          <section
            aria-label={labels.resultsRegionLabel}
            className="min-w-0 lg:max-w-sm xl:max-w-md"
            onKeyDownCapture={handleResultsListKeyDown}
          >
            <h2 className="mb-2 hidden text-xs font-bold uppercase tracking-wide text-muted lg:block">
              {labels.resultsHeading}
            </h2>
            <ul className="divide-y divide-ink/6 overflow-hidden rounded-2xl border border-ink/8 bg-surface shadow-sm outline-none focus-within:ring-2 focus-within:ring-accent/25">
              {visibleResults.map((result) => (
                <ResultEntry
                  key={`${result.kind}:${result.id}`}
                  labels={labels}
                  query={query}
                  result={result}
                  selected={
                    selected?.id === result.id && selected.kind === result.kind
                  }
                  onSelect={() => selectResult(result)}
                />
              ))}
            </ul>
            {isMobile ? (
              <p className="mt-3 text-center text-xs text-muted">{labels.detailMobileHint}</p>
            ) : null}
          </section>

          <section aria-label={labels.detailRegionLabel} className="hidden min-w-0 lg:block">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{labels.detailHeading}</h2>
            <SearchDetailPanel
              detail={detail}
              detailError={detailError}
              detailLoading={detailLoading}
              labels={labels}
              locale={locale}
              query={query}
              result={selected}
              userId={userId}
              variant="desktop"
            />
          </section>
        </div>
      )}

      {showMobileDetailBar ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-paper/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.08)] backdrop-blur-sm lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4">
            <div className="min-w-0 flex-1">
              <p className="truncate jp-text text-sm font-semibold text-ink">{selected.title}</p>
              {selected.reading ? (
                <p className="truncate jp-text text-xs text-muted">{selected.reading}</p>
              ) : null}
            </div>
            <button
              className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-xs font-bold text-surface shadow-sm transition-colors hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              type="button"
              onClick={(e) => {
                sheetReturnFocusRef.current = e.currentTarget;
                setDetailSheetOpen(true);
              }}
            >
              {labels.openDetail}
            </button>
          </div>
        </div>
      ) : null}

      </div>

      {isMobile && detailSheetOpen && selected && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-hidden
            className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
            tabIndex={-1}
            type="button"
            onClick={() => setDetailSheetOpen(false)}
          />
          <div
            ref={sheetPanelRef}
            aria-labelledby={sheetTitleId}
            aria-modal="true"
            className="absolute inset-x-0 bottom-0 max-h-[90vh] animate-in slide-in-from-bottom-4 rounded-t-2xl border border-ink/10 bg-paper shadow-2xl motion-reduce:animate-none"
            role="dialog"
          >
            <h2 className="sr-only" id={sheetTitleId}>
              {labels.detailHeading}
            </h2>
            <div className="flex justify-center border-b border-ink/8 py-2">
              <span className="h-1 w-10 rounded-full bg-ink/15" aria-hidden />
            </div>
            <div className="max-h-[calc(90vh-2rem)] overflow-y-auto px-3 pb-6 pt-2">
              <div className="mb-2 flex justify-end">
                <button
                  className="min-h-10 rounded-lg px-3 py-2 text-xs font-bold text-muted hover:bg-ink/5 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                  type="button"
                  onClick={() => setDetailSheetOpen(false)}
                >
                  {labels.closeSheet}
                </button>
              </div>
              <SearchDetailPanel
                detail={detail}
                detailError={detailError}
                detailLoading={detailLoading}
                labels={labels}
                locale={locale}
                query={query}
                result={selected}
                userId={userId}
                variant="sheet"
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SearchResultsLoadingSkeleton() {
  return (
    <div
      className="min-h-[min(52vh,28rem)] lg:grid lg:grid-cols-[minmax(260px,min(100%,24rem))_minmax(0,1fr)] lg:items-start lg:gap-8"
      aria-hidden
    >
      <div className="overflow-hidden rounded-2xl border border-ink/8 bg-surface/90">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex gap-3 border-b border-ink/5 py-3.5 pl-4 pr-3 last:border-b-0 motion-reduce:animate-none animate-pulse"
          >
            <div className="mt-0.5 h-6 w-6 shrink-0 rounded bg-ink/10" />
            <div className="min-w-0 flex-1 space-y-2 py-0.5">
              <div className="h-4 max-w-[12rem] rounded bg-ink/10" />
              <div className="h-3 max-w-[18rem] rounded bg-ink/8" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 hidden min-h-[20rem] animate-pulse rounded-2xl border border-ink/8 bg-surface/90 p-4 motion-reduce:animate-none lg:mt-0 lg:block">
        <div className="mb-4 h-5 max-w-[10rem] rounded bg-ink/10" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-ink/8" />
          <div className="h-3 w-full rounded bg-ink/8" />
          <div className="h-3 w-[92%] rounded bg-ink/8" />
          <div className="h-3 w-[88%] rounded bg-ink/8" />
        </div>
      </div>
    </div>
  );
}

function ResultEntry({
  labels,
  onSelect,
  query,
  result,
  selected
}: {
  labels: SearchLabels;
  onSelect: () => void;
  query: string;
  result: SearchResult;
  selected: boolean;
}) {
  const config = kindConfig[result.kind] ?? kindConfig.lexeme;
  const isKanji = result.kind === "kanji";

  return (
    <li>
      <button
        className={cn(
          "group flex w-full gap-3 border-l-[3px] py-3.5 pl-4 pr-3 text-left transition-colors hover:bg-accent/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/30",
          config.border,
          selected ? "bg-accent/[0.06]" : "bg-surface"
        )}
        type="button"
        onClick={onSelect}
      >
        {isKanji ? (
          <div className="flex shrink-0 items-start pt-0.5">
            <span className="jp-text text-3xl font-bold leading-none text-ink">
              <HighlightMatch query={query} text={result.title} />
            </span>
          </div>
        ) : (
          <div className="mt-0.5 shrink-0">
            <span
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold",
                config.bg
              )}
            >
              {config.icon}
            </span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            {!isKanji && (
              <span className="jp-text text-lg font-bold leading-tight text-ink">
                <HighlightMatch query={query} text={result.title} />
              </span>
            )}
            {result.reading ? (
              <span className="jp-text text-sm text-muted">
                <HighlightMatch query={query} text={result.reading} />
              </span>
            ) : null}
            {result.jlptLevel ? (
              <span className="ml-auto shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold leading-none text-accent">
                {result.jlptLevel}
              </span>
            ) : null}
          </div>
          {result.description ? (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink/70">
              <HighlightMatch query={query} text={result.description} />
            </p>
          ) : null}
        </div>

        <span aria-hidden className="shrink-0 self-center rounded-lg p-1.5 text-muted/50" title={labels.addToFlashcard}>
          <ChevronIcon />
        </span>
      </button>
    </li>
  );
}

function FilterPill({
  active,
  children,
  count,
  kind,
  onClick
}: {
  active: boolean;
  children: string;
  count: number;
  kind?: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "inline-flex min-h-9 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
        active ? "bg-ink text-surface shadow-sm" : "text-muted hover:bg-ink/5 hover:text-ink"
      )}
      type="button"
      onClick={onClick}
    >
      {kind && !active ? (
        <span aria-hidden className={cn("mr-0.5 inline-block h-2 w-2 rounded-full", kindDotColor(kind))} />
      ) : null}
      {children}
      {count > 0 && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
            active ? "bg-surface/20 text-surface" : "bg-ink/6 text-muted"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function SearchIcon({ "aria-hidden": ariaHidden, className }: { "aria-hidden"?: boolean; className?: string }) {
  return (
    <svg
      aria-hidden={ariaHidden ?? undefined}
      className={className}
      fill="none"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="18"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" x2="16.65" y1="21" y2="16.65" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden
      className="text-muted"
      fill="none"
      height="18"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="18"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
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

function kindDotColor(kind: string): string {
  switch (kind) {
    case "lexeme":
      return "bg-accent";
    case "kanji":
      return "bg-sakura";
    case "grammar":
      return "bg-leaf";
    case "example":
      return "bg-amber-400";
    default:
      return "bg-muted";
  }
}
