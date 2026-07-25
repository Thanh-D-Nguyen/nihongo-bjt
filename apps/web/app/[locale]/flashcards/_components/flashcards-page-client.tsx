"use client";

import {
  DEFAULT_FLASHCARD_THEME,
  flashcardThemeConfigSchema,
  type FlashcardThemeConfig
} from "@nihongo-bjt/shared";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  SectionHeader,
  TabButton,
  TabsList
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  IconBookmark,
  IconDeck,
  IconReview,
  IconSearch,
  IconSpark
} from "../../../_components/app-icons";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { queueSizeForUser } from "../../../../lib/offline-review-queue";
import { learnerApiFetch } from "../../../../lib/learner-api";
import { DeckBrowser, type DeckLabels, type LibraryDeckFilter } from "./deck-browser";
import { FlashcardStylePickerModal } from "./flashcard-style-picker";
import type { FlashcardLabels } from "./flashcards-client";
import { ReviewSession, type ReviewSessionLabels } from "./review-session";
import { AutoGenDialog, type CardgenLabels } from "./auto-gen-dialog";

type MainView = "review" | "library";

const DECK_SCOPE_ID_RE = /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

function isDeckScopeId(raw: string | null): raw is string {
  return raw !== null && DECK_SCOPE_ID_RE.test(raw);
}

export function FlashcardsPageClient({
  cardgenLabels,
  deckLabels,
  flashcardLabels,
  initialMain,
  locale,
  reviewSessionLabels
}: {
  cardgenLabels: CardgenLabels;
  deckLabels: DeckLabels;
  flashcardLabels: FlashcardLabels;
  initialMain: MainView;
  locale: string;
  reviewSessionLabels: ReviewSessionLabels;
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
  const [sessionActive, setSessionActive] = useState(false);
  const [autoGenOpen, setAutoGenOpen] = useState(false);
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [styleConfig, setStyleConfig] = useState<FlashcardThemeConfig>(
    DEFAULT_FLASHCARD_THEME.config
  );
  const [styleReady, setStyleReady] = useState(false);

  // Fetch active flashcard style on mount
  useEffect(() => {
    learnerApiFetch("/api/flashcards/styles/active")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const parsed = flashcardThemeConfigSchema.safeParse(data?.config);
        if (parsed.success) setStyleConfig(parsed.data);
      })
      .catch(() => undefined)
      .finally(() => setStyleReady(true));
  }, []);

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

  return (
    <main className="w-full space-y-5 pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <section className="overflow-hidden rounded-[1.75rem] border border-ink/10 bg-surface shadow-[0_18px_50px_-38px_rgba(15,23,42,0.5)]">
        <div className="flex flex-col gap-5 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">
              {flashcardLabels.libraryHeroKicker ?? flashcardLabels.eyebrow}
            </p>
            <h1 className="mt-1.5 max-w-2xl text-2xl font-black tracking-tight text-ink sm:text-3xl">
              {flashcardLabels.libraryHeroTitle ?? flashcardLabels.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-muted">
              {flashcardLabels.libraryDecksDescription ?? deckLabels.subtitle}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center lg:max-w-[34rem] lg:justify-end">
            <button
              className="col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-surface outline-none ring-offset-2 transition-colors hover:bg-ink/90 focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait disabled:opacity-55 sm:col-span-1"
              disabled={!styleReady}
              onClick={() => {
                selectRail("review");
                setSessionActive(true);
              }}
              type="button"
            >
              <IconReview aria-hidden size={16} />
              {flashcardLabels.libraryNavReview ?? flashcardLabels.reviewTab}
              {heroDue !== null && heroDue > 0 ? (
                <span className="ml-0.5 rounded-full bg-surface/15 px-2 py-0.5 text-xs font-black tabular-nums">
                  {heroDue}
                </span>
              ) : null}
            </button>
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-ink/12 bg-paper px-4 py-2.5 text-sm font-bold text-ink outline-none ring-offset-2 transition-colors hover:border-ink/20 hover:bg-white focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => setAutoGenOpen(true)}
              type="button"
            >
              <IconSpark aria-hidden size={16} />
              {cardgenLabels.title}
            </button>
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-ink/12 bg-paper px-4 py-2.5 text-sm font-bold text-ink outline-none ring-offset-2 transition-colors hover:border-ink/20 hover:bg-white focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => setStylePickerOpen(true)}
              type="button"
            >
              <span aria-hidden>🎨</span>
              {flashcardLabels.stylePickerTitle}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-ink/[0.08] bg-paper/55 sm:flex sm:justify-end">
          <div className="flex min-h-12 items-center justify-center px-4 text-xs font-semibold text-muted sm:justify-start">
            <span className="tabular-nums">
              {flashcardLabels.statDueSession}:{" "}
              <span className="font-black text-ink">{heroDue ?? "—"}</span>
            </span>
          </div>
          <div className="flex min-h-12 items-center justify-center border-l border-ink/[0.08] px-4 text-xs font-semibold text-muted sm:justify-start">
            <span className="tabular-nums">
              {flashcardLabels.statPendingSync}:{" "}
              <span className="font-black text-ink">{heroPending ?? "—"}</span>
            </span>
          </div>
        </div>
      </section>
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
                    selected ? "bg-ink text-surface" : "text-muted hover:bg-paper/80 hover:text-ink"
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
                          selected ? "text-surface/80" : "text-muted"
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
            title={
              main === "review"
                ? (flashcardLabels.libraryNavReview ?? flashcardLabels.reviewTab)
                : (flashcardLabels.libraryNavDecks ?? deckLabels.title)
            }
            description={
              main === "review"
                ? flashcardLabels.libraryReviewDescription
                : flashcardLabels.libraryDecksDescription
            }
            actions={
              main === "library" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={() => selectRail("review")}
                >
                  <IconReview aria-hidden size={16} />
                  {flashcardLabels.libraryNavReview ?? flashcardLabels.reviewTab}
                </Button>
              ) : undefined
            }
          />
          <div
            aria-labelledby={`${tabListId}-${activeRail}`}
            className="min-h-[12rem] rounded-2xl border border-ink/10 bg-surface p-3 sm:p-4"
            id={`${tabListId}-${activeRail}-panel`}
            role="tabpanel"
          >
            {main === "review" ? (
              <div className="mx-auto flex max-w-lg flex-col items-center gap-5 px-3 py-10 text-center sm:py-14">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-leaf/20 bg-leaf-soft text-leaf">
                  <IconReview aria-hidden size={30} />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-ink">
                    {reviewSessionLabels.entryTitle}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {heroDue !== null
                      ? reviewSessionLabels.entrySubtitle.replace("{n}", String(heroDue))
                      : reviewSessionLabels.loadingCards}
                  </p>
                </div>
                <button
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-ink px-7 text-sm font-bold text-surface outline-none ring-offset-2 transition-colors hover:bg-ink/90 focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait disabled:opacity-55"
                  disabled={!styleReady}
                  onClick={() => setSessionActive(true)}
                  type="button"
                >
                  {reviewSessionLabels.startSession}
                  <span aria-hidden className="ml-2">
                    →
                  </span>
                </button>
              </div>
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

      {/* Immersive review session overlay */}
      {sessionActive ? (
        <ReviewSession
          labels={reviewSessionLabels}
          locale={locale}
          scopeDeckId={scopeDeckId}
          styleConfig={styleConfig}
          onExit={() => {
            setSessionActive(false);
            void refreshDueHero();
          }}
        />
      ) : null}
      <AutoGenDialog
        open={autoGenOpen}
        onClose={() => setAutoGenOpen(false)}
        locale={locale}
        labels={cardgenLabels}
      />
      <FlashcardStylePickerModal
        open={stylePickerOpen}
        onClose={() => setStylePickerOpen(false)}
        onStyleApplied={(config) => setStyleConfig(config)}
        labels={flashcardLabels}
      />
    </main>
  );
}
