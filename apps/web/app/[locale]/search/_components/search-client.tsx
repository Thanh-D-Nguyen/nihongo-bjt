"use client";

import type { SearchResult } from "@nihongo-bjt/shared";
import { EmptyState, cn } from "@nihongo-bjt/ui";
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

import { VoiceSearchButton, type VoiceSearchLabels } from "../../../_components/search-advanced-inputs";
import { IconSearch } from "../../../_components/nav-icons";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { useRecentSearches } from "../../../../lib/use-recent-searches";
import { SearchDropdown, type DropdownKeyHandler, type SearchDropdownLabels } from "../../../_components/search-dropdown";
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
  /* ─── Voice search labels ─── */
  voiceListening?: string;
  voiceTitle?: string;
  voicePermissionDenied?: string;
  voiceNoSpeech?: string;
  voiceNetworkError?: string;
  voiceGenericError?: string;
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
  /** Debounce timer for instant search */
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Dropdown key handler for autocomplete */
  const dropdownKeyHandlerRef = useRef<DropdownKeyHandler | null>(null);

  const { searches: recentSearches, addSearch } = useRecentSearches();

  /** q + scope + level only — entry changes must not re-fetch the whole index */
  const urlSearchBootstrapKey = useMemo(
    () =>
      [
        searchParams.get("q") ?? "",
        searchParams.get("scope") ?? "",
        searchParams.get("level") ?? ""
      ].join("\u0001"),
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
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
    setDropdownOpen(false);
    if (query.trim()) addSearch(query.trim());
    // Cancel any pending debounce
    clearTimeout(debounceRef.current);
    updateUrl(query, filter, levelFilter, null);
  }

  /** Debounced instant search: triggers 300ms after user stops typing */
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pendingEntryRef.current = null;
      setSelected(null);
      addSearch(q);
      updateUrl(q, filter, levelFilter, null);
    }, 350);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function handleInputChange(value: string) {
    setQuery(value);
    if (value.trim()) {
      setDropdownOpen(true);
    } else {
      setDropdownOpen(true); // show recent searches
      // Clear results if field is emptied
      setResults([]);
      setHasSearched(false);
      setSelected(null);
      clearTimeout(debounceRef.current);
      updateUrl("", filter, levelFilter, null);
    }
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
      sheetReturnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
    isMobile &&
    selected &&
    !detailSheetOpen &&
    hasSearched &&
    visibleResults.length > 0 &&
    !loading &&
    !error;

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
    <main className={cn("mx-auto w-full max-w-6xl pb-24 md:pb-16", showMobileDetailBar && "pb-32")}>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {searchStatusAnnouncement}
      </p>
      <div inert={searchBodyInert ? true : undefined}>
        <div className="sticky top-0 z-20 rounded-b-2xl border-b border-ink/6 bg-paper/80 px-4 pb-3 pt-4 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.08),0_2px_8px_-2px_rgba(0,0,0,0.04)] backdrop-blur-xl sm:rounded-b-3xl sm:px-0">
          <form className="relative" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor="content-search">
              {labels.inputLabel}
            </label>
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <IconSearch
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/70"
                  size={18}
                />
                {loading && hasSearched && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2" aria-hidden>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent motion-reduce:animate-none" />
                  </div>
                )}
                <input
                  ref={inputRef}
                  id="content-search"
                  autoComplete="off"
                  className="min-h-12 w-full appearance-none rounded-2xl border border-ink/8 bg-surface/90 py-3 pl-10 pr-10 text-base text-ink shadow-md transition-all duration-200 placeholder:text-muted/50 focus:border-accent/30 focus:bg-surface focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
                  placeholder={labels.placeholder}
                  style={{ WebkitAppearance: "none", appearance: "none" }}
                  type="search"
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onFocus={() => setDropdownOpen(true)}
                  onKeyDown={(e) => {
                    if (dropdownKeyHandlerRef.current?.(e)) return;
                  }}
                />
                {/* Autocomplete dropdown */}
                <SearchDropdown
                  query={query}
                  open={dropdownOpen && !hasSearched}
                  onClose={() => setDropdownOpen(false)}
                  onSelect={(q) => {
                    setQuery(q);
                    setDropdownOpen(false);
                    clearTimeout(debounceRef.current);
                    pendingEntryRef.current = null;
                    setSelected(null);
                    addSearch(q);
                    updateUrl(q, filter, levelFilter, null);
                  }}
                  locale={locale}
                  labels={labels as unknown as SearchDropdownLabels}
                  onKeyHandlerReady={(handler) => { dropdownKeyHandlerRef.current = handler; }}
                />
              </div>
              <VoiceSearchButton
                className="shrink-0"
                locale={locale}
                labels={{
                  listening: labels.voiceListening,
                  title: labels.voiceTitle,
                  permissionDenied: labels.voicePermissionDenied,
                  noSpeech: labels.voiceNoSpeech,
                  networkError: labels.voiceNetworkError,
                  genericError: labels.voiceGenericError,
                }}
                onResult={(text) => {
                  setQuery(text);
                  setDropdownOpen(false);
                  clearTimeout(debounceRef.current);
                  pendingEntryRef.current = null;
                  setSelected(null);
                  addSearch(text);
                  updateUrl(text, filter, levelFilter, null);
                }}
              />
            </div>
            {/* Hidden submit to allow Enter key form submission */}
            <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>
              {labels.submit}
            </button>
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
                    "search-level-pill inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 active:scale-95",
                    levelFilter === lvl
                      ? "bg-accent text-surface shadow-md shadow-accent/20"
                      : "text-muted hover:bg-ink/5 hover:text-ink hover:shadow-sm"
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
          <p className="mt-3 px-4 text-xs font-medium text-muted sm:px-0">
            {labels.resultsForQueryLabel
              .replace("{count}", String(visibleResults.length))
              .replace("{query}", query.trim())}
          </p>
        )}

        {loading && hasSearched && (
          <div className="mt-4 min-h-[min(52vh,28rem)] px-4 sm:px-0" aria-busy="true">
            <SearchResultsLoadingSkeleton />
          </div>
        )}

        {error && (
          <EmptyState
            className="mx-4 mt-8 border-sakura/20 bg-sakura/5 sm:mx-0"
            role="alert"
            title={labels.error}
            action={
              query.trim() ? (
                <button
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-ink/12 bg-surface px-4 text-sm font-semibold text-ink shadow-sm transition-all duration-150 hover:border-ink/18 hover:bg-paper hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 active:scale-95"
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
              ) : null
            }
          />
        )}

        {!loading && !error && hasSearched && results.length === 0 && (
          <div className="search-empty-state mx-4 mt-10 flex flex-col items-center gap-4 rounded-3xl border border-ink/6 bg-gradient-to-b from-paper to-surface p-8 text-center shadow-sm sm:mx-0 sm:p-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/8">
              <IconSearch aria-hidden className="text-accent/40" size={28} />
            </div>
            <p className="text-sm font-bold text-ink">{labels.empty}</p>
            <p className="max-w-xs text-xs leading-relaxed text-muted">{labels.subtitle}</p>
            {/* Smart suggestions */}
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {labels.exampleChips.slice(0, 4).map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="rounded-full border border-ink/8 bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-all duration-150 hover:border-accent/20 hover:text-accent active:scale-95"
                  onClick={() => {
                    setQuery(chip);
                    setDropdownOpen(false);
                    clearTimeout(debounceRef.current);
                    pendingEntryRef.current = null;
                    setSelected(null);
                    addSearch(chip);
                    updateUrl(chip, filter, levelFilter, null);
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && hasSearched && results.length > 0 && visibleResults.length === 0 && (
          <EmptyState className="mx-4 mt-8 sm:mx-0" title={labels.noResultsInFilter} />
        )}

        {!hasSearched && !loading && (
          <div className="search-landing mt-8 px-4 sm:mt-12 sm:px-0">
            {/* Bento discovery grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {/* Hero card — spans 2 cols */}
              <div className="col-span-2 flex flex-col items-center justify-center gap-3 rounded-3xl border border-ink/6 bg-gradient-to-br from-accent/5 via-paper to-sakura/5 p-8 text-center shadow-sm sm:p-10">
                <div className="relative">
                  <span className="absolute inset-0 -z-10 mx-auto h-20 w-20 rounded-full bg-accent/10 blur-2xl" aria-hidden />
                  <span aria-hidden className="jp-text select-none text-6xl font-bold text-ink/12 sm:text-7xl">
                    {labels.landingHeroGlyph}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-ink sm:text-xl">{labels.title}</h2>
                <p className="max-w-sm text-sm leading-relaxed text-muted">{labels.subtitle}</p>
              </div>

              {/* Category quick-search cards */}
              {kinds.map((kind) => {
                const config = kindConfig[kind];
                return (
                  <button
                    key={kind}
                    type="button"
                    className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-ink/6 bg-surface p-5 shadow-sm transition-all duration-200 hover:border-ink/12 hover:shadow-md active:scale-[0.97]"
                    onClick={() => {
                      handleFilterChange(kind);
                      inputRef.current?.focus();
                    }}
                  >
                    <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold transition-transform duration-200 group-hover:scale-110", config.bg)}>
                      {config.icon}
                    </span>
                    <span className="text-xs font-semibold text-ink/80">{kindLabel(kind, labels)}</span>
                  </button>
                );
              })}
            </div>

            {/* Example chips */}
            <div className="mt-6 flex flex-col items-center gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted/60">{labels.exampleChipsAriaLabel}</p>
              <div
                className="flex flex-wrap justify-center gap-2"
                role="group"
                aria-label={labels.exampleChipsAriaLabel}
              >
                {labels.exampleChips.map((example) => (
                  <button
                    key={example}
                    className="search-example-chip min-h-10 rounded-full border border-ink/8 bg-surface px-4 py-2 text-sm font-medium text-ink/70 shadow-sm transition-all duration-150 hover:border-accent/20 hover:bg-accent/5 hover:text-accent hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 active:scale-95"
                    type="button"
                    onClick={() => {
                      setQuery(example);
                      setDropdownOpen(false);
                      clearTimeout(debounceRef.current);
                      pendingEntryRef.current = null;
                      setSelected(null);
                      addSearch(example);
                      updateUrl(example, filter, levelFilter, null);
                    }}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent searches section */}
            {recentSearches.length > 0 && (
              <div className="mt-6 rounded-2xl border border-ink/6 bg-surface/80 p-4 shadow-sm">
                <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-muted/70">
                  {labels.recentTitle ?? "Gần đây"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.slice(0, 6).map((term) => (
                    <button
                      key={term}
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-full border border-ink/6 bg-paper px-3 py-1.5 text-xs font-medium text-ink/70 transition-all duration-150 hover:border-accent/20 hover:text-accent active:scale-95"
                      onClick={() => {
                        setQuery(term);
                        setDropdownOpen(false);
                        clearTimeout(debounceRef.current);
                        pendingEntryRef.current = null;
                        setSelected(null);
                        updateUrl(term, filter, levelFilter, null);
                      }}
                    >
                      <svg className="h-3 w-3 text-muted/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="jp-text">{term}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* JLPT Level quick-access */}
            <div className="mt-5 flex items-center justify-center gap-2">
              <span className="text-[11px] font-semibold text-muted/60">JLPT:</span>
              {levels.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink/6 bg-surface text-[11px] font-bold text-muted shadow-sm transition-all duration-150 hover:border-accent/20 hover:text-accent hover:shadow-md active:scale-95"
                  onClick={() => {
                    handleLevelChange(lvl);
                    inputRef.current?.focus();
                  }}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && hasSearched && visibleResults.length > 0 && (
          <div className="mt-4 px-4 sm:px-0 md:mt-5 md:grid md:grid-cols-[minmax(220px,20rem)_minmax(0,1fr)] md:items-start md:gap-6 lg:mt-6 lg:grid-cols-[minmax(260px,min(100%,24rem))_minmax(0,1fr)] lg:gap-8">
            <section
              aria-label={labels.resultsRegionLabel}
              className="min-w-0 md:max-w-sm lg:max-w-sm xl:max-w-md"
              onKeyDownCapture={handleResultsListKeyDown}
            >
              <h2 className="mb-2 hidden text-xs font-bold uppercase tracking-wide text-muted lg:block">
                {labels.resultsHeading}
              </h2>
              <ul className="divide-y divide-ink/5 overflow-hidden rounded-2xl border border-ink/8 bg-surface shadow-md shadow-ink/[0.03] outline-none focus-within:ring-2 focus-within:ring-accent/25">
                {visibleResults.map((result, idx) => (
                  <ResultEntry
                    key={`${result.kind}:${result.id}`}
                    labels={labels}
                    query={query}
                    result={result}
                    selected={selected?.id === result.id && selected.kind === result.kind}
                    onSelect={() => selectResult(result)}
                    style={{ animation: `fadeSlideUp 0.25s ease-out ${Math.min(idx * 30, 300)}ms both` }}
                  />
                ))}
              </ul>
              {isMobile ? (
                <p className="mt-3 text-center text-xs text-muted">{labels.detailMobileHint}</p>
              ) : null}
            </section>

            <section aria-label={labels.detailRegionLabel} className="hidden min-w-0 md:block">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                {labels.detailHeading}
              </h2>
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
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/6 bg-paper/85 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_40px_-8px_rgba(0,0,0,0.12)] backdrop-blur-2xl md:hidden">
            <div className="mx-auto flex max-w-6xl items-center gap-3 px-4">
              {/* Kind icon badge */}
              <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold", kindConfig[selected.kind]?.bg ?? "bg-accent/10 text-accent")} aria-hidden>
                {kindConfig[selected.kind]?.icon ?? "文"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate jp-text text-sm font-bold text-ink">{selected.title}</p>
                <p className="truncate text-xs text-muted">
                  {selected.reading && <span className="jp-text">{selected.reading}</span>}
                  {selected.reading && selected.description && <span className="mx-1">·</span>}
                  {selected.description && <span className="line-clamp-1">{selected.description.slice(0, 40)}</span>}
                </p>
              </div>
              <button
                className="shrink-0 rounded-xl bg-ink px-4 py-2.5 text-xs font-bold text-surface shadow-md transition-all duration-150 hover:bg-ink/90 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            tabIndex={-1}
            type="button"
            onClick={() => setDetailSheetOpen(false)}
          />
          <div
            ref={sheetPanelRef}
            aria-labelledby={sheetTitleId}
            aria-modal="true"
            className="absolute inset-x-0 bottom-0 max-h-[90vh] rounded-t-3xl border border-ink/8 bg-paper shadow-2xl"
            role="dialog"
            style={{ animation: 'panelSlideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1) both' }}
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
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-ink/8 bg-surface px-3 py-2 text-xs font-bold text-muted shadow-sm transition-all duration-150 hover:bg-ink/5 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 active:scale-95"
                  type="button"
                  onClick={() => setDetailSheetOpen(false)}
                >
                  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
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
      className="min-h-[min(52vh,28rem)] md:grid md:grid-cols-[minmax(220px,20rem)_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[minmax(260px,min(100%,24rem))_minmax(0,1fr)] lg:gap-8"
      aria-hidden
    >
      <div className="overflow-hidden rounded-2xl border border-ink/8 bg-surface/90 shadow-md shadow-ink/[0.03]">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="flex gap-3 border-b border-ink/5 py-3.5 pl-4 pr-3 last:border-b-0"
            style={{ opacity: 1 - i * 0.08 }}
          >
            <div className="mt-0.5 h-7 w-7 shrink-0 rounded-lg search-skeleton-shimmer" />
            <div className="min-w-0 flex-1 space-y-2 py-0.5">
              <div className="h-4 max-w-[12rem] rounded search-skeleton-shimmer" />
              <div className="h-3 max-w-[18rem] rounded search-skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 hidden min-h-[20rem] rounded-3xl border border-ink/8 bg-surface/90 p-5 shadow-lg shadow-ink/[0.04] md:mt-0 md:block">
        <div className="mb-4 h-5 max-w-[10rem] rounded search-skeleton-shimmer" />
        <div className="space-y-3">
          <div className="h-3 w-full rounded search-skeleton-shimmer" />
          <div className="h-3 w-full rounded search-skeleton-shimmer" />
          <div className="h-3 w-[92%] rounded search-skeleton-shimmer" />
          <div className="h-3 w-[88%] rounded search-skeleton-shimmer" />
          <div className="h-3 w-[75%] rounded search-skeleton-shimmer" />
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
  selected,
  style
}: {
  labels: SearchLabels;
  onSelect: () => void;
  query: string;
  result: SearchResult;
  selected: boolean;
  style?: React.CSSProperties;
}) {
  const config = kindConfig[result.kind] ?? kindConfig.lexeme;
  const isKanji = result.kind === "kanji";

  return (
    <li style={style}>
      <button
        className={cn(
          "search-result-btn group flex w-full gap-3 border-l-[3px] py-3.5 pl-4 pr-3 text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/30",
          config.border,
          selected
            ? "bg-accent/[0.04] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)]"
            : "bg-surface hover:bg-ink/[0.02]",
          /* Kind-specific selected tint */
          selected && result.kind === "kanji" && "bg-sakura/[0.04]",
          selected && result.kind === "grammar" && "bg-leaf/[0.04]",
          selected && result.kind === "example" && "bg-amber-50/50"
        )}
        type="button"
        onClick={onSelect}
      >
        {isKanji ? (
          <div className="flex shrink-0 items-start">
            <span className="jp-text text-[2.25rem] font-bold leading-none text-ink group-hover:text-sakura/90 transition-colors">
              <HighlightMatch query={query} text={result.title} />
            </span>
          </div>
        ) : result.kind === "example" ? (
          <div className="mt-0.5 shrink-0">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-xs font-bold text-amber-700">
              {config.icon}
            </span>
          </div>
        ) : (
          <div className="mt-0.5 shrink-0">
            <span
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold",
                config.bg
              )}
            >
              {config.icon}
            </span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            {!isKanji && result.kind !== "example" && (
              <span className="jp-text text-lg font-bold leading-tight text-ink">
                <HighlightMatch query={query} text={result.title} />
              </span>
            )}
            {result.kind === "example" && (
              <span className="jp-text text-base leading-snug text-ink/85 italic">
                <HighlightMatch query={query} text={result.title} />
              </span>
            )}
            {result.reading ? (
              <span className="jp-text text-sm text-muted">
                <HighlightMatch query={query} text={result.reading} />
              </span>
            ) : null}
            {result.jlptLevel ? (
              <span className={cn(
                "ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none",
                result.kind === "kanji" ? "bg-sakura/10 text-sakura" :
                result.kind === "grammar" ? "bg-leaf/10 text-leaf" :
                "bg-accent/10 text-accent"
              )}>
                {result.jlptLevel}
              </span>
            ) : null}
            {result.kind === "grammar" && (
              <span className="shrink-0 rounded-md bg-leaf/8 px-1.5 py-0.5 text-[10px] font-semibold text-leaf">
                文法
              </span>
            )}
          </div>
          {result.description ? (
            <p className={cn(
              "mt-1 line-clamp-2 text-sm leading-relaxed",
              result.kind === "example" ? "text-ink/60" : "text-ink/70"
            )}>
              <HighlightMatch query={query} text={result.description} />
            </p>
          ) : null}
        </div>

        <span
          aria-hidden
          className="shrink-0 self-center rounded-lg p-1.5 text-muted/40 transition-colors duration-150 group-hover:text-ink/50"
          title={labels.addToFlashcard}
        >
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
        "search-filter-pill inline-flex min-h-9 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 active:scale-95",
        active ? "bg-ink text-surface shadow-md shadow-ink/15" : "text-muted hover:bg-ink/5 hover:text-ink hover:shadow-sm"
      )}
      type="button"
      onClick={onClick}
    >
      {kind && !active ? (
        <span
          aria-hidden
          className={cn("mr-0.5 inline-block h-2 w-2 rounded-full", kindDotColor(kind))}
        />
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
