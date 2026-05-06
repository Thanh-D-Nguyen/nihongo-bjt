"use client";

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
  card: { backText: string; frontText: string; id: string; reading: string | null };
  id: string;
  position: number;
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
      <div className="mx-auto w-full max-w-4xl space-y-4 px-3 py-4 sm:px-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-paper ring-1 ring-ink/8" />
        <div className="h-24 animate-pulse rounded-2xl bg-paper ring-1 ring-ink/8" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div className="h-16 animate-pulse rounded-xl bg-paper ring-1 ring-ink/8" key={i} />
          ))}
        </div>
        <p className="sr-only" role="status">
          {labels.deckDetailLoading}
        </p>
      </div>
    );
  }

  if (error || !deck) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 px-3 py-4 sm:px-4">
        <Link
          className="inline-flex min-h-10 items-center rounded-xl border border-ink/12 bg-paper px-4 text-sm font-bold text-ink hover:bg-white"
          href={backHref}
        >
          ← {labels.deckDetailBack}
        </Link>
        <p className="text-sm text-sakura" role="alert">
          {error ?? labels.deckDetailNotFound}
        </p>
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

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-3 py-4 sm:px-4 sm:py-6">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-ink/8 bg-surface/90 p-2 shadow-sm ring-1 ring-ink/[0.03] backdrop-blur-sm sm:gap-3 sm:p-2.5">
        <Link
          className="inline-flex min-h-11 items-center rounded-xl border border-ink/12 bg-paper px-4 text-sm font-black text-ink transition-colors hover:bg-white"
          href={backHref}
        >
          ← {labels.deckDetailBack}
        </Link>
        <Link
          className="inline-flex min-h-11 items-center rounded-xl bg-ink px-4 text-sm font-black text-surface shadow-sm transition hover:bg-ink/90"
          href={reviewHref}
        >
          {labels.reviewDeck}
        </Link>
        {isOwner ? (
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-ink/15 bg-paper px-4 text-sm font-black text-muted outline-none ring-offset-2 transition hover:border-sakura/35 hover:text-sakura focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => setPendingDelete(true)}
            type="button"
          >
            {labels.deleteOwnedDeck}
          </button>
        ) : null}
      </div>

      <header className="relative overflow-hidden rounded-3xl border border-ink/10 bg-gradient-to-br from-surface via-surface to-leaf-soft/25 p-5 shadow-md ring-1 ring-ink/[0.04] sm:p-7">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent via-leaf to-accent/60" aria-hidden />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-leaf">{labels.deckDetailKicker}</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">{title}</h1>
        {desc ? <p className="mt-3 max-w-prose text-sm font-semibold leading-relaxed text-muted sm:text-base">{desc}</p> : null}
        <p className="mt-4 max-w-prose border-t border-ink/8 pt-4 text-xs leading-relaxed text-muted sm:text-sm">
          {labels.deckDetailStudyHint}
        </p>
      </header>

      {sortedCards.length > 0 ? (
        <DeckStudySession
          key={deck.id}
          cards={sortedCards.map((row) => ({
            backText: row.card.backText,
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
            deckStudyModeNote: labels.deckStudyModeNote,
            deckStudyNext: labels.deckStudyNext,
            deckStudyPrev: labels.deckStudyPrev,
            deckStudyProgressTpl: labels.deckStudyProgressTpl,
            deckStudyTapToFlip: labels.deckStudyTapToFlip
          }}
        />
      ) : null}

      <section aria-labelledby="deck-cards-heading">
        {sortedCards.length === 0 ? (
          <>
            <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-muted" id="deck-cards-heading">
              {labels.deckDetailSectionCards}{" "}
              <span className="tabular-nums">(0)</span>
            </h2>
            <p className="rounded-2xl border border-dashed border-ink/15 bg-paper/50 px-4 py-8 text-center text-sm text-muted">
              {labels.empty}
            </p>
          </>
        ) : (
          <details className="group rounded-2xl border border-ink/8 bg-paper/40 shadow-sm open:bg-paper/55 open:shadow-md">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent [&::-webkit-details-marker]:hidden sm:px-5 sm:py-4">
              <div className="min-w-0">
                <h2 className="text-sm font-black text-ink sm:text-base" id="deck-cards-heading">
                  {labels.deckDetailAllCardsToggleTpl.replace("{count}", String(sortedCards.length))}
                </h2>
                <p className="mt-0.5 text-xs font-medium text-muted">{labels.deckDetailAllCardsHint}</p>
              </div>
              <span
                aria-hidden
                className="shrink-0 rounded-full border border-ink/10 bg-surface px-2 py-1 text-[10px] font-bold text-muted transition-transform duration-200 group-open:rotate-180"
              >
                ▾
              </span>
            </summary>
            <div className="border-t border-ink/8 px-3 pb-4 pt-1 sm:px-4 sm:pb-5">
              <ul className="max-h-[min(28rem,55vh)] space-y-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-[32rem]">
                {sortedCards.map((row, i) => (
                  <li
                    className="rounded-xl border border-ink/8 bg-surface/95 px-3 py-2.5 shadow-sm sm:px-4 sm:py-3"
                    key={row.id}
                  >
                    <p className="text-[10px] font-black uppercase tracking-wider text-muted">{i + 1}</p>
                    <p className="mt-1 text-sm font-bold text-ink" lang="ja">
                      {row.card.frontText}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">{row.card.backText}</p>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}
      </section>

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
