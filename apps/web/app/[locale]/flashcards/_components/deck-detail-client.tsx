"use client";

import { Badge, Button, Card, CardContent, cn, EmptyState, ErrorState, LoadingSkeleton } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";
import type { DeckLabels } from "./deck-browser";
import { deckDisplayDesc, deckDisplayTitle } from "./deck-card";
import type { DeckApiRow } from "./deck-types";
import { DeckComposerPanel, type DeckComposerInitialData } from "./deck-composer-panel";
import { DeckStudySession } from "./deck-study-session";

type DeckDetailCardRow = {
  card: {
    backText: string;
    examples?: DeckStudyExample[];
    frontText: string;
    id: string;
    primaryAudio?: DeckStudyMedia | null;
    primaryImage?: DeckStudyMedia | null;
    reading: string | null;
    sourceId?: string;
    sourceType?: string;
  };
  id: string;
  position: number;
  primaryAudio?: DeckStudyMedia | null;
  primaryImage?: DeckStudyMedia | null;
};

type DeckStudyMedia = {
  assetId: string;
  mimeType: string;
  readUrl: string | null;
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
  shareToken?: string | null;
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
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
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
      setShareToken(raw.shareToken ?? null);
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

  const handleShare = useCallback(async () => {
    if (!userId || !deck) return;
    setShareLoading(true);
    try {
      const r = await learnerApiFetch(
        `/api/flashcards/decks/${encodeURIComponent(deck.id)}/share`,
        { method: "POST" }
      );
      if (!r.ok) throw new Error("share_failed");
      const data = (await r.json()) as { shareToken: string };
      setShareToken(data.shareToken);
    } catch {
      setError("Không thể chia sẻ bộ thẻ");
    } finally {
      setShareLoading(false);
    }
  }, [userId, deck]);

  const handleUnshare = useCallback(async () => {
    if (!userId || !deck) return;
    setShareLoading(true);
    try {
      const r = await learnerApiFetch(
        `/api/flashcards/decks/${encodeURIComponent(deck.id)}/share`,
        { method: "DELETE" }
      );
      if (!r.ok) throw new Error("unshare_failed");
      setShareToken(null);
    } catch {
      setError("Không thể hủy chia sẻ");
    } finally {
      setShareLoading(false);
    }
  }, [userId, deck]);

  const handleCopyLink = useCallback(async () => {
    if (!shareToken) return;
    const url = `${window.location.origin}/${locale}/decks/shared/${encodeURIComponent(shareToken)}`;
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }, [shareToken, locale]);

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
  const editInitialData: DeckComposerInitialData = {
    cards: sortedCards.map((row) => ({
      backText: row.card.backText,
      cardId: row.card.id,
      deckCardId: row.id,
      frontText: row.card.frontText,
      primaryImageAssetId: (row.primaryImage ?? row.card.primaryImage)?.assetId ?? null,
      reading: row.card.reading
    })),
    deckId: deck.id,
    descriptionVi: deck.descriptionVi ?? null,
    titleJa: deck.titleJa ?? null,
    titleVi: deck.titleVi,
    visibility: deck.visibility
  };

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
          <div className="flex shrink-0 flex-col gap-2 sm:min-w-[18rem] lg:items-end">
            <Link
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-surface shadow-sm transition hover:bg-ink/90 sm:w-auto sm:min-w-44"
              href={reviewHref}
            >
              <PlayIcon />
              {labels.reviewDeck}
            </Link>
            {isOwner ? (
              <div aria-label={labels.ariaToolbar} className="flex w-full flex-wrap items-center justify-start gap-2 lg:justify-end" role="toolbar">
                <HeaderActionButton
                  icon={<EditIcon />}
                  label={editMode ? labels.cancel : labels.editDeck}
                  onClick={() => setEditMode((value) => !value)}
                />
                {!shareToken ? (
                  <HeaderActionButton
                    disabled={shareLoading}
                    icon={<ShareIcon />}
                    label={shareLoading ? "Đang tạo link…" : "Chia sẻ"}
                    onClick={() => void handleShare()}
                  />
                ) : (
                  <>
                    <HeaderActionButton
                      icon={shareCopied ? <CheckIcon /> : <CopyIcon />}
                      label={shareCopied ? "Đã copy" : "Copy link"}
                      onClick={() => void handleCopyLink()}
                    />
                    <HeaderActionButton
                      disabled={shareLoading}
                      icon={<LockIcon />}
                      label="Tắt share"
                      onClick={() => void handleUnshare()}
                    />
                  </>
                )}
                <HeaderActionButton
                  danger
                  icon={<TrashIcon />}
                  label="Gỡ"
                  onClick={() => setPendingDelete(true)}
                />
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {editMode && isOwner && userId ? (
        <section className="rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm ring-1 ring-ink/[0.03] sm:p-5">
          <DeckComposerPanel
            initialData={editInitialData}
            labels={labels}
            mode="edit"
            onCancel={() => setEditMode(false)}
            onSuccess={async () => {
              setEditMode(false);
              await load();
            }}
            userId={userId}
          />
        </section>
      ) : null}

      <div className={cn("grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start", editMode && "opacity-60")}>
        <div className="min-w-0">
          {sortedCards.length > 0 ? (
            <DeckStudySession
              key={deck.id}
              cards={sortedCards.map((row) => ({
                backText: row.card.backText,
                examples: row.card.examples ?? [],
                frontText: row.card.frontText,
                id: row.id,
                primaryAudio: row.primaryAudio ?? row.card.primaryAudio ?? null,
                primaryImage: row.primaryImage ?? row.card.primaryImage ?? null,
                reading: row.card.reading
              }))}
              focusIndex={focusIndex}
              onIndexChange={setActiveIndex}
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
                deckStudyAutoRead: labels.deckStudyAutoRead,
                deckStudyHideImages: labels.deckStudyHideImages,
                deckStudyReadCard: labels.deckStudyReadCard,
                deckStudyShowImages: labels.deckStudyShowImages,
                deckStudyTapToFlip: labels.deckStudyTapToFlip,
                deckStudyToolsAria: labels.deckStudyToolsAria,
                exampleCopy: labels.deckStudyExampleCopy,
                exampleCopied: labels.deckStudyExampleCopied,
                exampleEmpty: labels.deckStudyExampleEmpty,
                exampleFilterPlaceholder: labels.deckStudyExampleFilterPlaceholder,
                exampleHeading: labels.deckStudyExampleHeading,
                exampleManage: labels.deckStudyExampleManage,
                exampleRead: labels.deckStudyExampleRead,
                exampleSourceGrammar: labels.deckStudyExampleSourceGrammar,
                exampleSourceKanji: labels.deckStudyExampleSourceKanji,
                exampleSourceLexeme: labels.deckStudyExampleSourceLexeme,
                exampleToggleHide: labels.deckStudyExampleToggleHide,
                exampleToggleShow: labels.deckStudyExampleToggleShow,
                deckStudyRateAgain: labels.deckStudyRateAgain,
                deckStudyRateHard: labels.deckStudyRateHard,
                deckStudyRateGood: labels.deckStudyRateGood,
                deckStudyRateHint: labels.deckStudyRateHint,
                mentorName: labels.mentorName,
                mentorGoodEmoji: labels.mentorGoodEmoji,
                mentorGoodText: labels.mentorGoodText,
                mentorHardEmoji: labels.mentorHardEmoji,
                mentorHardText: labels.mentorHardText,
                mentorAgainEmoji: labels.mentorAgainEmoji,
                mentorAgainText: labels.mentorAgainText,
                mentorMilestone5: labels.mentorMilestone5,
                mentorMilestone10: labels.mentorMilestone10,
                mentorMilestone25: labels.mentorMilestone25,
                streakLabel: labels.streakLabel
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
            activeIndex={activeIndex}
            cards={sortedCards}
            labels={labels}
            onGoToCard={(i) => setFocusIndex(i)}
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

function HeaderActionButton({
  danger,
  disabled,
  icon,
  label,
  onClick,
}: {
  danger?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold outline-none ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-45",
        danger
          ? "border-sakura/25 bg-sakura/5 text-sakura hover:border-sakura/40 hover:bg-sakura/10"
          : "border-ink/12 bg-paper/80 text-ink hover:border-ink/20 hover:bg-white"
      )}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  );
}

function PlayIcon() {
  return (
    <IconBase>
      <path d="M5 3v18l15-9L5 3Z" />
    </IconBase>
  );
}

function EditIcon() {
  return (
    <IconBase>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </IconBase>
  );
}

function ShareIcon() {
  return (
    <IconBase>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4" />
      <path d="m15.4 6.5-6.8 4" />
    </IconBase>
  );
}

function CopyIcon() {
  return (
    <IconBase>
      <rect height="14" rx="2" width="14" x="8" y="8" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </IconBase>
  );
}

function CheckIcon() {
  return (
    <IconBase>
      <path d="m20 6-11 11-5-5" />
    </IconBase>
  );
}

function LockIcon() {
  return (
    <IconBase>
      <rect height="11" rx="2" width="16" x="4" y="11" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </IconBase>
  );
}

function TrashIcon() {
  return (
    <IconBase>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14H5V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </IconBase>
  );
}

/* ── Collapsible card list sidebar ── */
function CardListCollapsible({
  activeIndex,
  cards,
  labels,
  onGoToCard,
}: {
  activeIndex: number;
  cards: DeckDetailCardRow[];
  labels: DeckLabels;
  onGoToCard: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  // Auto-scroll to active card in the list
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeIndex, open]);

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
              <ul ref={listRef} className="max-h-[32rem] divide-y divide-ink/6 overflow-y-auto overscroll-contain">
                {cards.map((row, i) => (
                  <li
                    className={cn(
                      "cursor-pointer px-4 py-3 transition hover:bg-paper/60",
                      i === activeIndex && "bg-accent-soft/30 ring-1 ring-inset ring-accent/20"
                    )}
                    key={row.id}
                    onClick={() => onGoToCard(i)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onGoToCard(i);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
                          i === activeIndex
                            ? "bg-accent text-white shadow-sm"
                            : "bg-paper text-muted"
                        )}
                      >
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
