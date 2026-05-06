"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { queueSizeForUser } from "../../../../lib/offline-review-queue";
import { learnerApiFetch } from "../../../../lib/learner-api";
import {
  DeckBrowser,
  type DeckLabels,
  type LibraryDeckFilter
} from "./deck-browser";
import { FlashcardsClient, type FlashcardLabels } from "./flashcards-client";

type MainView = "review" | "library";

const DECK_SCOPE_ID_RE =
  /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

function isDeckScopeId(raw: string | null): raw is string {
  return raw !== null && DECK_SCOPE_ID_RE.test(raw);
}

function IconReview() {
  return (
    <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path
        d="M4 19.5V5.75A2.75 2.75 0 0 1 6.75 3H20v16H6.75A2.75 2.75 0 0 0 4 21.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 7h8M8 11h6" strokeLinecap="round" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M5 7.5 12 4l7 3.5-7 3.5-7-3.5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m5 12 7 3.5 7-3.5M5 16.5l7 3.5 7-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" strokeLinecap="round" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export function FlashcardsPageClient({
  deckLabels,
  flashcardLabels,
  initialMain,
  locale
}: {
  deckLabels: DeckLabels;
  flashcardLabels: FlashcardLabels;
  initialMain: MainView;
  locale: string;
}) {
  const { userId } = useKeycloakAuth();
  const tabListId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const deckIdParam = searchParams.get("deckId");
  const scopeDeckId = isDeckScopeId(deckIdParam) ? deckIdParam : null;
  const [main, setMain] = useState<MainView>(initialMain);
  const [deckFilter, setDeckFilter] = useState<LibraryDeckFilter>("my");
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [heroDue, setHeroDue] = useState<number | null>(null);
  const [heroPending, setHeroPending] = useState<number | null>(null);

  const refreshDueHero = useCallback(async () => {
    if (!userId) return;
    try {
      const params = new URLSearchParams({
        limit: "500",
        userId
      });
      const deckForHero = main === "review" && scopeDeckId ? scopeDeckId : null;
      if (deckForHero) {
        params.set("deckId", deckForHero);
      }
      const r = await learnerApiFetch(`/api/flashcards/reviews/due?${params.toString()}`);
      if (!r.ok) return;
      const j = (await r.json()) as unknown[];
      setHeroDue(Array.isArray(j) ? j.length : 0);
    } catch {
      /* keep previous dash */
    }
  }, [main, scopeDeckId, userId]);

  useEffect(() => {
    void refreshDueHero();
  }, [refreshDueHero]);

  useEffect(() => {
    if (!userId) return;
    void queueSizeForUser(userId).then((n) => setHeroPending(n));
  }, [userId, main, deckFilter, createOpen]);

  const railItems = useMemo(
    () => [
      {
        description: flashcardLabels.libraryReviewDescription ?? flashcardLabels.sessionFocusHint,
        icon: <IconReview />,
        id: "review" as const,
        label: flashcardLabels.libraryNavReview ?? flashcardLabels.reviewTab
      },
      {
        description: flashcardLabels.libraryNavMySetsDescription ?? deckLabels.subtitle,
        icon: <IconLayers />,
        id: "my" as const,
        label: flashcardLabels.libraryNavMySets ?? deckLabels.myDecks
      },
      {
        description: flashcardLabels.libraryNavPublicDescription ?? "",
        icon: <IconGlobe />,
        id: "public" as const,
        label: flashcardLabels.libraryNavPublicSets ?? deckLabels.publicDecks
      },
      {
        description: flashcardLabels.libraryNavRecentDescription ?? "",
        icon: <IconClock />,
        id: "recent" as const,
        label: flashcardLabels.libraryNavRecent ?? flashcardLabels.libraryRecentTitle
      },
      {
        description: flashcardLabels.libraryNavCreateDescription ?? "",
        icon: <IconPlus />,
        id: "create" as const,
        label: flashcardLabels.libraryNavCreate ?? deckLabels.createDeck
      }
    ],
    [deckLabels, flashcardLabels]
  );

  const activeRail = useMemo(() => {
    if (main === "review") return "review" as const;
    if (createOpen) return "create" as const;
    return deckFilter;
  }, [main, createOpen, deckFilter]);

  useEffect(() => {
    setMain(initialMain);
  }, [initialMain]);

  const syncTabToUrl = useCallback(
    (next: MainView) => {
      const p = new URLSearchParams(searchParams.toString());
      if (next === "review") {
        p.set("tab", "review");
        p.delete("deckId");
      } else {
        p.delete("tab");
        p.delete("deckId");
      }
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const selectRail = (id: (typeof railItems)[number]["id"]) => {
    if (id === "review") {
      setMain("review");
      syncTabToUrl("review");
      setCreateOpen(false);
      void refreshDueHero();
      return;
    }
    setMain("library");
    syncTabToUrl("library");
    setCreateOpen(id === "create");
    if (id === "my" || id === "public" || id === "recent") {
      setDeckFilter(id);
    }
    if (id === "create") {
      setDeckFilter((prev) => prev);
    }
  };

  const showLibrarySearch = main === "library";

  return (
    <main className="mx-auto w-full max-w-7xl px-3 pb-16 pt-1 sm:px-5 sm:pb-20 lg:pt-2">
      <div className="mb-3 space-y-3 lg:mb-4">
        <header className="rounded-2xl border border-ink/10 bg-surface px-4 py-3 shadow-sm sm:px-5 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-leaf">
                {flashcardLabels.libraryHeroKicker ?? flashcardLabels.eyebrow}
              </p>
              <h1 className="mt-1 truncate text-xl font-black tracking-tight text-ink sm:text-2xl">
                {flashcardLabels.libraryHeroTitle ?? flashcardLabels.title}
              </h1>
              <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-muted sm:text-sm">
                {flashcardLabels.librarySubtitle ?? flashcardLabels.subtitle}
              </p>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2 sm:max-w-xs">
              <div className="rounded-xl border border-ink/10 bg-paper/60 px-3 py-2">
                <p className="text-[10px] font-bold uppercase text-muted">
                  {flashcardLabels.libraryDueMetric ?? flashcardLabels.statDueSession}
                </p>
                <p className="mt-0.5 text-xl font-black tabular-nums text-ink">
                  {heroDue === null ? "—" : heroDue}
                </p>
              </div>
              <div className="rounded-xl border border-ink/10 bg-paper/60 px-3 py-2">
                <p className="text-[10px] font-bold uppercase text-muted">
                  {flashcardLabels.libraryOfflineMetric ?? flashcardLabels.statPendingSync}
                </p>
                <p className="mt-0.5 text-xl font-black tabular-nums text-ink">
                  {heroPending === null ? "—" : heroPending}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile segmented rail */}
        <div className="sticky top-14 z-20 -mx-3 border-y border-ink/8 bg-paper/90 px-2 py-2 backdrop-blur-md sm:-mx-5 lg:hidden">
          <div
            aria-label={flashcardLabels.libraryMobileNavAria ?? flashcardLabels.title}
            className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
          >
            {railItems.map((item) => {
              const selected = activeRail === item.id;
              return (
                <button
                  aria-selected={selected}
                  className={`shrink-0 rounded-full px-3 py-2 text-left text-xs font-black outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-accent ${
                    selected ? "bg-ink text-surface shadow-sm" : "bg-surface text-ink ring-1 ring-ink/10"
                  }`}
                  key={item.id}
                  onClick={() => selectRail(item.id)}
                  role="tab"
                  type="button"
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          {showLibrarySearch ? (
            <label className="mt-2 block px-1" htmlFor={`${tabListId}-msearch`}>
              <span className="sr-only">{flashcardLabels.librarySearchPlaceholder}</span>
              <input
                className="min-h-10 w-full rounded-xl border border-ink/10 bg-surface px-3 text-sm font-semibold text-ink outline-none placeholder:text-muted/80 focus:border-leaf focus:ring-1 focus:ring-leaf"
                id={`${tabListId}-msearch`}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={flashcardLabels.librarySearchPlaceholder}
                type="search"
                value={searchQuery}
              />
            </label>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start lg:space-y-3">
          {showLibrarySearch ? (
            <div className="rounded-xl border border-ink/10 bg-surface p-2 shadow-sm">
              <label className="sr-only" htmlFor={`${tabListId}-search`}>
                {flashcardLabels.librarySearchPlaceholder}
              </label>
              <input
                className="min-h-10 w-full rounded-lg border border-ink/10 bg-paper/70 px-3 text-sm font-semibold text-ink outline-none placeholder:text-muted/80 focus:border-leaf focus:bg-white focus:ring-1 focus:ring-leaf"
                id={`${tabListId}-search`}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={flashcardLabels.librarySearchPlaceholder}
                type="search"
                value={searchQuery}
              />
            </div>
          ) : null}

          <nav
            aria-label={flashcardLabels.librarySidebarAria ?? flashcardLabels.title}
            className="rounded-2xl border border-ink/10 bg-surface p-1.5 shadow-sm"
            id={tabListId}
            role="tablist"
          >
            {railItems.map((item) => {
              const selected = activeRail === item.id;
              return (
                <button
                  aria-controls={`${tabListId}-${item.id}-panel`}
                  aria-selected={selected}
                  className={`mb-1 flex w-full items-start gap-2 rounded-xl px-2.5 py-2.5 text-left outline-none ring-offset-2 transition last:mb-0 focus-visible:ring-2 focus-visible:ring-accent ${
                    selected ? "bg-ink text-surface shadow-sm" : "text-muted hover:bg-paper/80 hover:text-ink"
                  }`}
                  id={`${tabListId}-${item.id}`}
                  key={item.id}
                  onClick={() => selectRail(item.id)}
                  role="tab"
                  type="button"
                >
                  <span className="mt-0.5 shrink-0">{item.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-black leading-tight">{item.label}</span>
                    {item.description ? (
                      <span
                        className={`mt-0.5 block text-[10px] font-semibold leading-snug ${
                          selected ? "text-white/65" : "text-muted"
                        }`}
                      >
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="rounded-xl border border-leaf/20 bg-leaf-soft/50 p-3">
            <p className="text-[10px] font-black uppercase text-leaf">
              {flashcardLabels.libraryStudyGoal ?? flashcardLabels.eyebrow}
            </p>
            <p className="mt-1.5 text-xs font-semibold leading-snug text-ink">
              {flashcardLabels.sessionFocusHint}
            </p>
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <div
            aria-labelledby={`${tabListId}-${activeRail}`}
            className="min-h-[12rem]"
            id={`${tabListId}-${activeRail}-panel`}
            role="tabpanel"
          >
            {main === "review" ? (
              <FlashcardsClient
                compact
                labels={flashcardLabels}
                locale={locale}
                onPendingSyncChange={setHeroPending}
                scopeDeckId={scopeDeckId}
              />
            ) : (
              <DeckBrowser
                createMode={createOpen}
                filter={deckFilter}
                labels={deckLabels}
                locale={locale}
                onCreateModeChange={setCreateOpen}
                onDeckCreated={async ({ startReview }) => {
                  if (startReview) {
                    setCreateOpen(false);
                    setMain("review");
                    syncTabToUrl("review");
                    await refreshDueHero();
                  }
                }}
                onDecksChanged={() => void refreshDueHero()}
                searchQuery={searchQuery}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
