"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  ProgressBar,
  SectionHeader,
  TabButton,
  TabsList
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { IconBookmark, IconDeck, IconReview, IconSearch, IconSpark } from "../../../_components/app-icons";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { queueSizeForUser } from "../../../../lib/offline-review-queue";
import { learnerApiFetch } from "../../../../lib/learner-api";
import { DeckBrowser, type DeckLabels, type LibraryDeckFilter } from "./deck-browser";
import { FlashcardsClient, type FlashcardLabels } from "./flashcards-client";

type MainView = "review" | "library";

const DECK_SCOPE_ID_RE = /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

function isDeckScopeId(raw: string | null): raw is string {
  return raw !== null && DECK_SCOPE_ID_RE.test(raw);
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
        icon: <IconReview aria-hidden size={18} />,
        id: "review" as const,
        label: flashcardLabels.libraryNavReview ?? flashcardLabels.reviewTab
      },
      {
        description: flashcardLabels.libraryNavMySetsDescription ?? deckLabels.subtitle,
        icon: <IconDeck aria-hidden size={18} />,
        id: "my" as const,
        label: flashcardLabels.libraryNavMySets ?? deckLabels.myDecks
      },
      {
        description: flashcardLabels.libraryNavPublicDescription ?? "",
        icon: <IconSearch aria-hidden size={18} />,
        id: "public" as const,
        label: flashcardLabels.libraryNavPublicSets ?? deckLabels.publicDecks
      },
      {
        description: flashcardLabels.libraryNavRecentDescription ?? "",
        icon: <IconSpark aria-hidden size={18} />,
        id: "recent" as const,
        label: flashcardLabels.libraryNavRecent ?? flashcardLabels.libraryRecentTitle
      },
      {
        description: flashcardLabels.libraryNavCreateDescription ?? "",
        icon: <IconBookmark aria-hidden size={18} />,
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
  const dueValue = heroDue ?? 0;
  const pendingValue = heroPending ?? 0;
  const reviewProgress = Math.max(8, Math.min(100, dueValue > 0 ? 100 - Math.min(dueValue, 20) * 3 : 100));

  return (
    <main className="w-full space-y-6 pb-16">
      <PageHeader
        eyebrow={flashcardLabels.libraryHeroKicker ?? flashcardLabels.eyebrow}
        title={flashcardLabels.libraryHeroTitle ?? flashcardLabels.title}
        description={flashcardLabels.librarySubtitle ?? flashcardLabels.subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              className="min-h-10"
              size="sm"
              type="button"
              onClick={() => selectRail("review")}
            >
              <IconReview aria-hidden size={16} />
              {flashcardLabels.libraryNavReview ?? flashcardLabels.reviewTab}
            </Button>
            <Badge className="min-h-10 justify-center px-3" tone="accent">
              {(flashcardLabels.libraryDueMetric ?? flashcardLabels.statDueSession) + ": "}
              <span className="ml-1 tabular-nums text-ink">{heroDue === null ? "—" : heroDue}</span>
            </Badge>
          </div>
        }
      >
        <div className="grid gap-3 pt-2 sm:grid-cols-3">
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted">{flashcardLabels.libraryDueMetric ?? flashcardLabels.statDueSession}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{heroDue === null ? "—" : heroDue}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted">{flashcardLabels.libraryOfflineMetric ?? flashcardLabels.statPendingSync}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{heroPending === null ? "—" : heroPending}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm sm:col-span-1">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted">{flashcardLabels.libraryStudyGoal ?? flashcardLabels.eyebrow}</p>
              <ProgressBar className="mt-3" value={reviewProgress} />
              <p className="mt-2 text-xs leading-snug text-muted">{flashcardLabels.sessionFocusHint}</p>
            </CardContent>
          </Card>
        </div>
      </PageHeader>
      <div className="space-y-3 lg:mb-4">
        {/* Mobile segmented rail */}
        <div className="sticky top-16 z-20 -mx-4 border-y border-ink/8 bg-paper/94 px-4 py-2 backdrop-blur-md sm:-mx-6 lg:hidden">
          <TabsList
            aria-label={flashcardLabels.libraryMobileNavAria ?? flashcardLabels.title}
            className="flex w-full overflow-x-auto border-0 bg-transparent p-0 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {railItems.map((item) => {
              const selected = activeRail === item.id;
              return (
                <TabButton
                  active={selected}
                  className="shrink-0"
                  key={item.id}
                  onClick={() => selectRail(item.id)}
                >
                  {item.label}
                </TabButton>
              );
            })}
          </TabsList>
          {showLibrarySearch ? (
            <label className="mt-2 block px-1" htmlFor={`${tabListId}-msearch`}>
              <span className="sr-only">{flashcardLabels.librarySearchPlaceholder}</span>
              <Input
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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,244px)_minmax(0,1fr)] lg:gap-8">
        <aside className="hidden lg:block lg:sticky lg:top-24 lg:self-start lg:space-y-3">
          {showLibrarySearch ? (
            <Card className="rounded-xl">
              <CardContent className="p-2">
                <label className="sr-only" htmlFor={`${tabListId}-search`}>
                  {flashcardLabels.librarySearchPlaceholder}
                </label>
                <Input
                  className="min-h-10 rounded-lg bg-paper/70 shadow-none focus:bg-white"
                  id={`${tabListId}-search`}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={flashcardLabels.librarySearchPlaceholder}
                  type="search"
                  value={searchQuery}
                />
              </CardContent>
            </Card>
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
                  className={`mb-1 flex w-full items-start gap-2.5 rounded-xl px-3 py-3 text-left outline-none ring-offset-2 transition last:mb-0 focus-visible:ring-2 focus-visible:ring-accent ${
                    selected
                      ? "bg-ink text-surface shadow-sm"
                      : "text-muted hover:bg-paper/80 hover:text-ink"
                  }`}
                  id={`${tabListId}-${item.id}`}
                  key={item.id}
                  onClick={() => selectRail(item.id)}
                  role="tab"
                  type="button"
                >
                  <span className="mt-0.5 shrink-0">{item.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-tight">{item.label}</span>
                    {item.description ? (
                      <span
                        className={`mt-1 block text-[11px] font-semibold leading-snug ${
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

          <Card className="rounded-xl border-accent/15 bg-accent/8 shadow-none">
            <CardHeader className="p-3 pb-0">
              <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-accent">
                <IconSpark aria-hidden size={16} />
                {flashcardLabels.libraryStudyGoal ?? flashcardLabels.eyebrow}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-2">
              <p className="text-xs font-semibold leading-snug text-ink">
                {flashcardLabels.sessionFocusHint}
              </p>
            </CardContent>
          </Card>
        </aside>

        <div className="min-w-0 space-y-4">
          <SectionHeader
            title={main === "review" ? (flashcardLabels.libraryNavReview ?? flashcardLabels.reviewTab) : (flashcardLabels.libraryNavDecks ?? deckLabels.title)}
            description={main === "review" ? flashcardLabels.libraryReviewDescription : flashcardLabels.libraryDecksDescription}
            actions={
              main === "library" ? (
                <Button size="sm" variant="secondary" type="button" onClick={() => selectRail("review")}>
                  <IconReview aria-hidden size={16} />
                  {flashcardLabels.libraryNavReview ?? flashcardLabels.reviewTab}
                </Button>
              ) : undefined
            }
          />
          <div
            aria-labelledby={`${tabListId}-${activeRail}`}
            className="min-h-[12rem] rounded-2xl border border-ink/10 bg-surface/55 p-3 shadow-[0_10px_30px_rgba(23,33,31,0.045)] sm:p-4"
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
