"use client";

import { Badge, Button, Card, CardContent, EmptyState, ErrorState, LoadingSkeleton } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";
import type { DeckLabels } from "./deck-browser";
import { deckDisplayDesc, deckDisplayTitle } from "./deck-card";
import type { DeckApiRow } from "./deck-types";
import { DeckStudySession } from "./deck-study-session";

type DeckDetailCardRow = {
  card: {
    backText: string;
    examples?: DeckStudyExample[];
    frontText: string;
    id: string;
    reading: string | null;
    sourceId?: string;
    sourceType?: string;
  };
  id: string;
  position: number;
};

type DeckStudyExample = {
  id: string;
  japaneseText: string;
  reading: string | null;
  sourceKind: "grammar" | "kanji" | "lexeme";
  translationVi: string | null;
};

type DeckDetailPayload = {
  cards: DeckDetailCardRow[];
  descriptionJa?: string | null;
  descriptionVi?: string | null;
  id: string;
  ownerUserId: string | null;
  status: string;
  titleJa?: string | null;
  titleVi: string;
  visibility: string;
};

export function DeckDetailClient({
  deckId,
  labels,
  locale
}: {
  deckId: string;
  labels: DeckLabels;
  locale: string;
}) {
  const { userId } = useKeycloakAuth();
  const router = useRouter();
  const [deck, setDeck] = useState<DeckDetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const deleteTitleId = useId();
  const deleteBodyId = useId();

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await learnerApiFetch(`/api/decks/${encodeURIComponent(deckId)}?userId=${encodeURIComponent(userId)}`);
      if (!r.ok) {
        setDeck(null);
        setError(r.status === 404 ? labels.deckDetailNotFound : labels.error);
        return;
      }
      const raw = (await r.json()) as DeckDetailPayload;
      setDeck(raw);
    } catch {
      setDeck(null);
      setError(labels.error);
    } finally {
      setLoading(false);
    }
  }, [deckId, labels.deckDetailNotFound, labels.error, userId]);

  const confirmArchive = useCallback(async () => {
    if (!userId || !deck) return;
    setDeleteSubmitting(true);
    setError(null);
    try {
      const r = await learnerApiFetch(
        `/api/flashcards/decks/${encodeURIComponent(deck.id.trim())}/archive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId })
        }
      );
      if (!r.ok) throw new Error("delete_failed");
      setPendingDelete(false);
      router.push(`/${locale}/flashcards`);
    } catch {
      setError(labels.deleteOwnedDeckError);
    } finally {
      setDeleteSubmitting(false);
    }
  }, [userId, deck, locale, router, labels.deleteOwnedDeckError]);

  useEffect(() => {
    void load();
  }, [load]);

  const backHref = `/${locale}/flashcards`;
  const reviewHref = `/${locale}/flashcards?tab=review&deckId=${encodeURIComponent(deckId)}`;

  if (loading && !deck) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6 lg:py-8">
        <LoadingSkeleton className="h-10 w-44 rounded-xl" />
        <LoadingSkeleton className="h-44 rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <LoadingSkeleton className="h-[28rem] rounded-2xl" />
          <div className="space-y-3">
            <LoadingSkeleton className="h-28 rounded-2xl" />
            <LoadingSkeleton className="h-40 rounded-2xl" />
          </div>
        </div>
        <p className="sr-only" role="status">
          {labels.deckDetailLoading}
        </p>
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 sm:px-6">
        <Link
          className="inline-flex min-h-10 items-center rounded-xl border border-ink/12 bg-paper px-4 text-sm font-bold text-ink hover:bg-white"
          href={backHref}
        >
          ← {labels.deckDetailBack}
        </Link>
        <ErrorState description={error ?? labels.deckDetailNotFound} title={labels.deckDetailPageTitle} />
      </div>
    );
  }

  const apiRow: DeckApiRow = {
    descriptionJa: deck.descriptionJa ?? null,
    descriptionVi: deck.descriptionVi ?? null,
    id: deck.id,
    ownerUserId: deck.ownerUserId ?? null,
    status: deck.status,
    titleJa: deck.titleJa ?? null,
    titleVi: deck.titleVi,
    visibility: deck.visibility
  };
  const title = deckDisplayTitle(apiRow, locale);
  const desc = deckDisplayDesc(apiRow, locale);
  const isOwner = Boolean(userId && deck.ownerUserId === userId);

  const sortedCards = [...deck.cards].sort((a, b) => a.position - b.position);
  const visibilityLabel = deck.visibility === "public" ? labels.public : labels.private;
  const statusLabel = deck.status === "active" ? labels.statusActive : labels.statusArchived;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 sm:px-6 lg:py-8">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link
          className="inline-flex min-h-9 items-center rounded-lg px-2 font-semibold transition hover:bg-ink/5 hover:text-ink"
          href={backHref}
        >
          ← {labels.deckDetailBack}
        </Link>
      </nav>

      <header className="rounded-2xl border border-ink/10 bg-surface p-5 shadow-sm ring-1 ring-ink/[0.03] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">{labels.deckDetailKicker}</Badge>
              <Badge>{visibilityLabel}</Badge>
              <Badge>{statusLabel}</Badge>
            </div>
            <h1 className="mt-3 max-w-3xl text-2xl font-semibold leading-tight text-ink sm:text-3xl">{title}</h1>
            {desc ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">{desc}</p> : null}
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{labels.deckDetailStudyHint}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-4 text-sm font-semibold text-surface shadow-sm transition hover:bg-ink/90"
              href={reviewHref}
            >
              {labels.reviewDeck}
            </Link>
            {isOwner ? (
              <Button onClick={() => setPendingDelete(true)} type="button" variant="secondary">
                {labels.deleteOwnedDeck}
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0">
          {sortedCards.length > 0 ? (
            <DeckStudySession
              key={deck.id}
              cards={sortedCards.map((row) => ({
                backText: row.card.backText,
                examples: row.card.examples ?? [],
                frontText: row.card.frontText,
                id: row.id,
                reading: row.card.reading
              }))}
              labels={{
                deckStudyEyebrow: labels.deckStudyEyebrow,
                deckStudyFaceBack: labels.deckStudyFaceBack,
                deckStudyFaceFront: labels.deckStudyFaceFront,
                deckStudyFlipPrompt: labels.deckStudyFlipPrompt,
                deckStudyKeyboardHint: labels.deckStudyKeyboardHint,
                deckStudyModeFlip: labels.deckStudyModeFlip,
                deckStudyModeShuffle: labels.deckStudyModeShuffle,
                deckStudyModeQuiz: labels.deckStudyModeQuiz,
                deckStudyQuizPrompt: labels.deckStudyQuizPrompt,
                deckStudyQuizCorrect: labels.deckStudyQuizCorrect,
                deckStudyQuizWrong: labels.deckStudyQuizWrong,
                deckStudyQuizAnswer: labels.deckStudyQuizAnswer,
                deckStudyComplete: labels.deckStudyComplete,
                deckStudyCompleteDesc: labels.deckStudyCompleteDesc,
                deckStudyCompleteAccuracy: labels.deckStudyCompleteAccuracy,
                deckStudyRestart: labels.deckStudyRestart,
                deckStudyStartReview: labels.deckStudyStartReview,
                deckStudyModeNote: labels.deckStudyModeNote,
                deckStudyNext: labels.deckStudyNext,
                deckStudyPrev: labels.deckStudyPrev,
                deckStudyProgressTpl: labels.deckStudyProgressTpl,
                deckStudyTapToFlip: labels.deckStudyTapToFlip,
                exampleCopy: labels.deckStudyExampleCopy,
                exampleCopied: labels.deckStudyExampleCopied,
                exampleEmpty: labels.deckStudyExampleEmpty,
                exampleFilterPlaceholder: labels.deckStudyExampleFilterPlaceholder,
                exampleHeading: labels.deckStudyExampleHeading,
                exampleManage: labels.deckStudyExampleManage,
                exampleSourceGrammar: labels.deckStudyExampleSourceGrammar,
                exampleSourceKanji: labels.deckStudyExampleSourceKanji,
                exampleSourceLexeme: labels.deckStudyExampleSourceLexeme,
                exampleToggleHide: labels.deckStudyExampleToggleHide,
                exampleToggleShow: labels.deckStudyExampleToggleShow
              }}
            />
          ) : (
            <EmptyState description={labels.empty} title={labels.deckDetailSectionCards} />
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black tabular-nums text-ink">{sortedCards.length}</span>
                <span className="text-sm font-semibold text-muted">{labels.cards}</span>
              </div>
              <Link
                className="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-ink px-4 text-sm font-bold text-surface shadow-sm transition hover:bg-ink/90"
                href={reviewHref}
              >
                {labels.reviewDeck}
              </Link>
            </CardContent>
          </Card>

          <CardListCollapsible
            cards={sortedCards}
            labels={labels}
          />
        </aside>
      </div>

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/45 p-4 sm:items-center"
          onClick={() => {
            if (!deleteSubmitting) setPendingDelete(false);
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
              if (e.key === "Escape" && !deleteSubmitting) setPendingDelete(false);
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
                onClick={() => setPendingDelete(false)}
                type="button"
              >
                {labels.deleteOwnedDeckCancel}
              </button>
              <button
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--color-sakura)] px-4 text-sm font-bold text-white outline-none ring-offset-2 hover:opacity-95 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                disabled={deleteSubmitting}
                onClick={() => void confirmArchive()}
                type="button"
              >
                {deleteSubmitting ? labels.deleteOwnedDeckDeleting : labels.deleteOwnedDeckConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── Collapsible card list sidebar ── */
function CardListCollapsible({
  cards,
  labels
}: {
  cards: DeckDetailCardRow[];
  labels: DeckLabels;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section aria-labelledby="deck-cards-heading">
      <Card>
        <CardContent className="p-0">
          <button
            className="flex w-full items-center justify-between border-b border-ink/8 px-4 py-3 text-left transition hover:bg-paper/60"
            onClick={() => setOpen((v) => !v)}
            type="button"
          >
            <h2 className="text-sm font-semibold text-ink" id="deck-cards-heading">
              {labels.deckDetailAllCardsToggleTpl.replace("{count}", String(cards.length))}
            </h2>
            <span className={`text-xs font-bold text-muted transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
          </button>
          {open ? (
            cards.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">{labels.empty}</p>
            ) : (
              <ul className="max-h-[32rem] divide-y divide-ink/6 overflow-y-auto overscroll-contain">
                {cards.map((row, i) => (
                  <li className="px-4 py-3 transition hover:bg-paper/60" key={row.id}>
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-paper text-xs font-semibold tabular-nums text-muted">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug text-ink" lang="ja">
                          {row.card.frontText}
                        </p>
                        {row.card.reading ? (
                          <p className="mt-0.5 text-xs text-muted" lang="ja">
                            {row.card.reading}
                          </p>
                        ) : null}
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{row.card.backText}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
