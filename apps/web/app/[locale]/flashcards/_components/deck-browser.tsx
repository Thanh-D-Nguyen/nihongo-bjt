"use client";

import {
  Button,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  TabButton,
  TabsList
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";
import { DeckComposerPanel, type DeckComposerLabels } from "./deck-composer-panel";
import { DeckCard } from "./deck-card";
import { DeckGrid } from "./deck-grid";
import type { DeckApiRow } from "./deck-types";

export type LibraryDeckFilter = "my" | "public" | "recent";

export type DeckLabels = DeckComposerLabels & {
  ariaToolbar: string;
  cards: string;
  deckDetailBack: string;
  deckDetailKicker: string;
  deckDetailLoading: string;
  deckDetailNotFound: string;
  deckDetailPageTitle: string;
  deckDetailSectionCards: string;
  deckDetailStudyHint: string;
  deckDetailAllCardsHint: string;
  deckDetailAllCardsToggleTpl: string;
  deckStudyEyebrow: string;
  deckStudyFaceBack: string;
  deckStudyFaceFront: string;
  deckStudyFlipPrompt: string;
  deckStudyKeyboardHint: string;
  deckStudyModeFlip: string;
  deckStudyModeShuffle: string;
  deckStudyModeQuiz: string;
  deckStudyQuizPrompt: string;
  deckStudyQuizCorrect: string;
  deckStudyQuizWrong: string;
  deckStudyQuizAnswer: string;
  deckStudyComplete: string;
  deckStudyCompleteDesc: string;
  deckStudyCompleteAccuracy: string;
  deckStudyRestart: string;
  deckStudyStartReview: string;
  deckStudyModeNote: string;
  deckStudyNext: string;
  deckStudyPrev: string;
  deckStudyProgressTpl: string;
  deckStudyTapToFlip: string;
  deckStudyExampleCopied: string;
  deckStudyExampleCopy: string;
  deckStudyExampleEmpty: string;
  deckStudyExampleFilterPlaceholder: string;
  deckStudyExampleHeading: string;
  deckStudyExampleManage: string;
  deckStudyExampleSourceGrammar: string;
  deckStudyExampleSourceKanji: string;
  deckStudyExampleSourceLexeme: string;
  deckStudyExampleToggleHide: string;
  deckStudyExampleToggleShow: string;
  openDeckAria: string;
  create: string;
  createDeck: string;
  creating: string;
  createdLabel: string;
  deleteOwnedDeck: string;
  deleteOwnedDeckAria: string;
  deleteOwnedDeckCancel: string;
  deleteOwnedDeckConfirm: string;
  deleteOwnedDeckConfirmBody: string;
  deleteOwnedDeckConfirmTitle: string;
  deleteOwnedDeckDeleting: string;
  deleteOwnedDeckError: string;
  empty: string;
  emptyMy: string;
  emptyMyHint: string;
  emptyPublic: string;
  emptyRecent: string;
  emptySearch: string;
  emptySearchHint: string;
  gridAriaLabel: string;
  listAriaLabel: string;
  loading: string;
  myDecks: string;
  publicDecks: string;
  reloadDecks: string;
  recentSectionTitle: string;
  reviewDeck: string;
  statusActive: string;
  statusArchived: string;
  subtitle: string;
  title: string;
  updatedLabel: string;
  viewGrid: string;
  viewList: string;
};

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function matchesSearch(deck: DeckApiRow, q: string): boolean {
  if (!q) return true;
  const n = normalize(q);
  const hay = [deck.titleVi, deck.titleJa ?? "", deck.descriptionVi ?? "", deck.descriptionJa ?? ""]
    .join(" ")
    .toLowerCase();
  return hay.includes(n);
}

export function DeckBrowser({
  createMode,
  filter,
  labels,
  locale,
  onCreateModeChange,
  onDeckCreated,
  onDecksChanged,
  searchQuery
}: {
  createMode: boolean;
  filter: LibraryDeckFilter;
  labels: DeckLabels;
  locale: string;
  onCreateModeChange: (open: boolean) => void;
  onDeckCreated?: (opts: { startReview: boolean }) => void | Promise<void>;
  onDecksChanged?: () => void | Promise<void>;
  searchQuery: string;
}) {
  const { userId } = useKeycloakAuth();
  const [decks, setDecks] = useState<DeckApiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [pendingDeleteDeck, setPendingDeleteDeck] = useState<DeckApiRow | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const loadDecks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await learnerApiFetch(
        `/api/flashcards/decks?userId=${encodeURIComponent(userId)}&limit=80`
      );
      if (!r.ok) throw new Error("load_failed");
      const raw = (await r.json()) as DeckApiRow[];
      setDecks(raw);
    } catch {
      setError(labels.error);
    } finally {
      setLoading(false);
    }
  }, [userId, labels.error]);

  useEffect(() => {
    if (userId) void loadDecks();
  }, [userId, loadDecks]);

  const filteredByScope = useMemo(() => {
    if (!userId) return [];
    let rows = [...decks];
    if (filter === "my") {
      rows = rows.filter((d) => d.ownerUserId === userId);
    } else if (filter === "public") {
      rows = rows.filter((d) => d.visibility === "public" && d.ownerUserId !== userId);
    } else if (filter === "recent") {
      rows.sort((a, b) => {
        const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
        const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
        return tb - ta;
      });
      rows = rows.slice(0, 24);
    }
    return rows.filter((d) => matchesSearch(d, searchQuery));
  }, [decks, filter, searchQuery, userId]);

  const deckCardLabels = useMemo(
    () => ({
      cards: labels.cards,
      createdLabel: labels.createdLabel,
      gridAriaLabel: labels.gridAriaLabel,
      listAriaLabel: labels.listAriaLabel,
      openDeckAria: labels.openDeckAria,
      private: labels.private,
      public: labels.public,
      statusActive: labels.statusActive,
      statusArchived: labels.statusArchived,
      updatedLabel: labels.updatedLabel
    }),
    [labels]
  );

  const deleteTitleId = useId();
  const deleteBodyId = useId();

  const confirmArchiveOwnedDeck = useCallback(async () => {
    if (!userId || !pendingDeleteDeck) return;
    setDeleteSubmitting(true);
    setError(null);
    try {
      const r = await learnerApiFetch(
        `/api/flashcards/decks/${encodeURIComponent(pendingDeleteDeck.id.trim())}/archive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId })
        }
      );
      if (!r.ok) throw new Error("delete_failed");
      setPendingDeleteDeck(null);
      await loadDecks();
      await onDecksChanged?.();
    } catch {
      setError(labels.deleteOwnedDeckError);
    } finally {
      setDeleteSubmitting(false);
    }
  }, [userId, pendingDeleteDeck, loadDecks, onDecksChanged, labels.deleteOwnedDeckError]);

  if (createMode && userId) {
    return (
      <section aria-label={labels.title} className="space-y-4">
        <DeckComposerPanel
          labels={labels}
          userId={userId}
          onCancel={() => onCreateModeChange(false)}
          onSuccess={async ({ startReview }) => {
            await loadDecks();
            onCreateModeChange(false);
            await onDeckCreated?.({ startReview });
          }}
        />
      </section>
    );
  }

  const sectionTitle =
    filter === "my"
      ? labels.myDecks
      : filter === "public"
        ? labels.publicDecks
        : labels.recentSectionTitle;

  const emptyTitle =
    searchQuery.trim().length > 0
      ? labels.emptySearch
      : filter === "my"
        ? labels.emptyMy
        : filter === "public"
          ? labels.emptyPublic
          : filter === "recent"
            ? labels.emptyRecent
            : labels.empty;

  const emptyDescription =
    searchQuery.trim().length > 0
      ? labels.emptySearchHint
      : filter === "my"
        ? labels.emptyMyHint
        : "";

  return (
    <section aria-label={labels.title} className="space-y-4">
      <div
        aria-label={labels.ariaToolbar}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="text-lg font-bold text-ink">{sectionTitle}</h2>
          <p className="text-xs font-semibold text-muted">{labels.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TabsList role="group">
            <TabButton
              aria-label={labels.viewGrid}
              aria-pressed={viewMode === "grid"}
              active={viewMode === "grid"}
              onClick={() => setViewMode("grid")}
            >
              {labels.viewGrid}
            </TabButton>
            <TabButton
              aria-label={labels.viewList}
              aria-pressed={viewMode === "list"}
              active={viewMode === "list"}
              onClick={() => setViewMode("list")}
            >
              {labels.viewList}
            </TabButton>
          </TabsList>
          <Button
            size="sm"
            variant="secondary"
            disabled={loading}
            onClick={() => void loadDecks()}
            type="button"
          >
            {labels.reloadDecks}
          </Button>
          <Button size="sm" onClick={() => onCreateModeChange(true)} type="button">
            {labels.createDeck}
          </Button>
        </div>
      </div>

      {error ? <ErrorState className="py-5" title={error} /> : null}

      {loading && decks.length === 0 ? (
        <div aria-busy className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <LoadingSkeleton className="h-28" key={i} />
          ))}
        </div>
      ) : null}

      {!loading && !error && filteredByScope.length === 0 ? (
        <EmptyState
          action={
            filter === "my" || filter === "recent" ? (
              <Button onClick={() => onCreateModeChange(true)} type="button">
                {labels.createDeck}
              </Button>
            ) : undefined
          }
          description={emptyDescription || undefined}
          title={emptyTitle}
        />
      ) : null}

      {filteredByScope.length > 0 ? (
        <DeckGrid mode={viewMode}>
          {filteredByScope.map((d) => {
            const isOwner = Boolean(userId && d.ownerUserId === userId);
            return (
              <DeckCard
                key={d.id}
                deck={d}
                href={`/${locale}/flashcards/decks/${d.id}`}
                insideFooter={
                  isOwner ? (
                    <button
                      aria-label={labels.deleteOwnedDeckAria}
                      className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-ink/15 bg-surface px-2.5 text-[11px] font-bold uppercase tracking-wide text-muted shadow-sm outline-none ring-offset-2 hover:border-sakura/35 hover:text-sakura focus-visible:ring-2 focus-visible:ring-accent"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setPendingDeleteDeck(d);
                      }}
                      type="button"
                    >
                      {labels.deleteOwnedDeck}
                    </button>
                  ) : undefined
                }
                labels={deckCardLabels}
                locale={locale}
                mode={viewMode}
              />
            );
          })}
        </DeckGrid>
      ) : null}

      {pendingDeleteDeck ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/45 p-4 sm:items-center"
          onClick={() => {
            if (!deleteSubmitting) setPendingDeleteDeck(null);
          }}
          role="presentation"
        >
          <div
            aria-describedby={deleteBodyId}
            aria-labelledby={deleteTitleId}
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !deleteSubmitting) setPendingDeleteDeck(null);
            }}
            role="alertdialog"
          >
            <h3 className="text-base font-bold text-ink" id={deleteTitleId}>
              {labels.deleteOwnedDeckConfirmTitle}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ink/85" id={deleteBodyId}>
              {labels.deleteOwnedDeckConfirmBody}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink/12 bg-paper px-4 text-sm font-bold text-ink outline-none ring-offset-2 hover:bg-white focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                disabled={deleteSubmitting}
                onClick={() => setPendingDeleteDeck(null)}
                type="button"
              >
                {labels.deleteOwnedDeckCancel}
              </button>
              <button
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--color-sakura)] px-4 text-sm font-bold text-white outline-none ring-offset-2 hover:opacity-95 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                disabled={deleteSubmitting}
                onClick={() => void confirmArchiveOwnedDeck()}
                type="button"
              >
                {deleteSubmitting ? labels.deleteOwnedDeckDeleting : labels.deleteOwnedDeckConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
