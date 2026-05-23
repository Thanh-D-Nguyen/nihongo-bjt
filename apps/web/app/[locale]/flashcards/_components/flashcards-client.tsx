"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button, EmptyState, ErrorState, LoadingSkeleton, cn } from "@nihongo-bjt/ui";
import Link from "next/link";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import {
  drainForUser,
  enqueueReview,
  queueSizeForUser
} from "../../../../lib/offline-review-queue";
import { learnerApiFetch } from "../../../../lib/learner-api";
import { FlashcardInteractiveCard } from "./flashcard-interactive-card";
import type { MentorLabels } from "./flashcard-interactive-card";

const allowedMime = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxBytes = 10 * 1024 * 1024;

interface DueCard {
  card: {
    backText: string;
    frontText: string;
    id: string;
    reading: string | null;
  };
  cardId: string;
  id: string;
  primaryImage: { assetId: string; mimeType: string; readUrl: string | null } | null;
  state: string;
}

interface ReviewFeedback {
  rating: "again" | "hard" | "good";
  remediation?: {
    sourceId: string;
    sourceIdKind: string;
    sourceType: string;
  };
  comebackMode?: boolean;
}

type ImageFlowState =
  | { step: "idle" }
  | { step: "uploading" }
  | { step: "completing" }
  | { step: "linking" }
  | { step: "success" }
  | { step: "error"; userMessage: string; showCors: boolean };

export interface FlashcardLabels {
  again: string;
  answerHeading: string;
  comebackBody: string;
  comebackNext: string;
  comebackSkill: string;
  comebackTitle: string;
  compactReviewEyebrow?: string;
  empty: string;
  emptyCtaDaily: string;
  emptyCtaSearch: string;
  emptyDescription: string;
  emptyTitle: string;
  error: string;
  eyebrow: string;
  good: string;
  hard: string;
  imageAlt: string;
  imageCompleting: string;
  imageError: string;
  imageErrorCors: string;
  imageErrorSize: string;
  imageErrorType: string;
  imageHint: string;
  imageLinking: string;
  imageSectionTitle: string;
  imageSuccess: string;
  imageUploadLabel: string;
  imageUploading: string;
  inputLabel: string;
  libraryAddFromSearchCta?: string;
  libraryCreateSet?: string;
  libraryDecksDescription?: string;
  libraryDueMetric?: string;
  libraryHeroKicker?: string;
  libraryHeroTitle?: string;
  libraryImportCta?: string;
  libraryMobileNavAria?: string;
  libraryNavCreate?: string;
  libraryNavCreateDescription?: string;
  libraryNavDecks?: string;
  libraryNavMySets?: string;
  libraryNavMySetsDescription?: string;
  libraryNavPublicDescription?: string;
  libraryNavPublicSets?: string;
  libraryNavRecent?: string;
  libraryNavRecentDescription?: string;
  libraryNavReview?: string;
  libraryOfflineMetric?: string;
  libraryRecentTitle?: string;
  libraryReviewDescription?: string;
  librarySearchPlaceholder?: string;
  librarySidebarAria?: string;
  libraryStudyGoal?: string;
  librarySubtitle?: string;
  load: string;
  loading: string;
  offlineFlushFail: string;
  offlineFlushOk: string;
  offlinePendingLine: string;
  offlineQueued: string;
  offlineSyncing: string;
  placeholder: string;
  quotaExceeded: string;
  quotaLine: string;
  refreshDue: string;
  reveal: string;
  reviewScopeBackToDeckCta: string;
  reviewScopeBanner: string;
  reviewScopeClearCta: string;
  reviewScopeEmptyDescription: string;
  reviewScopeEmptyTitle: string;
  reviewImageOptionalSummary: string;
  reviewPhaseAnswer: string;
  reviewPhaseQuestion: string;
  reviewTab: string;
  sessionFocusHint: string;
  statDueSession: string;
  statPendingSync: string;
  subtitle: string;
  title: string;
  mentorName: string;
  mentorGoodEmoji: string;
  mentorGoodText: string;
  mentorHardEmoji: string;
  mentorHardText: string;
  mentorAgainEmoji: string;
  mentorAgainText: string;
  mentorMilestone5: string;
  mentorMilestone10: string;
  mentorMilestone25: string;
  streakLabel: string;
}

function imageFlowLabel(step: ImageFlowState["step"], labels: FlashcardLabels): string | null {
  switch (step) {
    case "completing": {
      return labels.imageCompleting;
    }
    case "linking": {
      return labels.imageLinking;
    }
    case "success": {
      return labels.imageSuccess;
    }
    case "uploading": {
      return labels.imageUploading;
    }
    default: {
      return null;
    }
  }
}

const btnBase =
  "inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-bold outline-none ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-45";
const btnPrimary = `${btnBase} bg-leaf text-white hover:bg-leaf/90`;
const btnSecondary = `${btnBase} border border-ink/15 bg-surface text-ink hover:border-ink/25 hover:bg-paper`;
const btnNeutral = `${btnBase} border border-ink/12 bg-paper/80 text-ink hover:bg-paper`;

export function FlashcardsClient({
  compact = false,
  labels,
  locale,
  onPendingSyncChange,
  scopeDeckId = null
}: {
  compact?: boolean;
  labels: FlashcardLabels;
  locale: string;
  onPendingSyncChange?: (n: number) => void;
  scopeDeckId?: string | null;
}) {
  const fileInputId = useId();
  const [cards, setCards] = useState<DueCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [imageFlow, setImageFlow] = useState<ImageFlowState>({ step: "idle" });
  const [loading, setLoading] = useState(false);
  const [quotaLine, setQuotaLine] = useState<string | null>(null);
  const [pendingOffline, setPendingOffline] = useState(0);
  const [queueStatus, setQueueStatus] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState<ReviewFeedback | null>(null);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [sessionInitialTotal, setSessionInitialTotal] = useState(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { userId } = useKeycloakAuth();

  const clearFeedbackTimer = () => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearFeedbackTimer();
  }, []);

  const flushQueue = useCallback(async () => {
    const uid = userId;
    if (!uid) {
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }
    setQueueStatus(labels.offlineSyncing);
    let pending: Awaited<ReturnType<typeof drainForUser>>;
    try {
      pending = await drainForUser(uid);
    } catch {
      setQueueStatus(null);
      return;
    }
    if (pending.length === 0) {
      setPendingOffline(0);
      setQueueStatus(null);
      return;
    }
    try {
      const response = await learnerApiFetch("/api/flashcards/reviews/batch", {
        body: JSON.stringify({
          items: pending.map((p) => ({
            clientMutationId: p.clientMutationId,
            elapsedMs: p.elapsedMs,
            rating: p.rating,
            userFlashcardId: p.userFlashcardId
          })),
          userId: uid
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!response.ok) {
        for (const p of pending) {
          await enqueueReview(p);
        }
        setQueueStatus(labels.offlineFlushFail);
        if (response.status === 403) {
          setError(labels.quotaExceeded);
        }
        return;
      }
      const data = (await response.json()) as {
        results: Array<{ clientMutationId: string; error?: string; ok: boolean }>;
      };
      for (const r of data.results) {
        if (!r.ok) {
          const found = pending.find((p) => p.clientMutationId === r.clientMutationId);
          if (found) {
            await enqueueReview(found);
          }
        }
      }
      setPendingOffline(await queueSizeForUser(uid));
      setQueueStatus(labels.offlineFlushOk);
    } catch {
      for (const p of pending) {
        await enqueueReview(p);
      }
      setQueueStatus(labels.offlineFlushFail);
    }
  }, [
    labels.offlineFlushFail,
    labels.offlineFlushOk,
    labels.offlineSyncing,
    labels.quotaExceeded,
    userId
  ]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const onOnline = () => {
      void flushQueue();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("online", onOnline);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onOnline);
      }
    };
  }, [flushQueue, userId]);

  useEffect(() => {
    void (async () => {
      if (typeof window === "undefined" || !userId) {
        return;
      }
      setPendingOffline(await queueSizeForUser(userId));
    })();
  }, [userId]);

  useEffect(() => {
    onPendingSyncChange?.(pendingOffline);
  }, [onPendingSyncChange, pendingOffline]);

  const loadDueCards = useCallback(
    async (options?: { resetImageFlow?: boolean }) => {
      if (!userId) {
        return;
      }
      const uid = userId;
      if (options?.resetImageFlow !== false) {
        setImageFlow({ step: "idle" });
      }
      setError(null);
      setLoading(true);
      setQuotaLine(null);
      try {
        const params = new URLSearchParams({
          limit: "10",
          userId: uid
        });
        if (scopeDeckId) {
          params.set("deckId", scopeDeckId);
        }
        const response = await learnerApiFetch(`/api/flashcards/reviews/due?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Due review request failed");
        }
        const dueCards = (await response.json()) as DueCard[];
        setCards(dueCards);
        setRevealed(false);
        setSessionReviewed(0);
        setSessionInitialTotal(dueCards.length);
        const sum = await learnerApiFetch(
          `/api/learner/monetization/summary?userId=${encodeURIComponent(uid)}`
        );
        if (sum.ok) {
          const j = (await sum.json()) as {
            enforcementEnabled?: boolean;
            flashcardDay: {
              limit: number;
              planSlug: string;
              remaining: number;
              used: number;
              windowKey: string;
            };
          };
          if (j.enforcementEnabled !== false) {
            setQuotaLine(
              labels.quotaLine
                .replace("{used}", String(j.flashcardDay.used))
                .replace("{limit}", String(j.flashcardDay.limit))
                .replace("{remaining}", String(j.flashcardDay.remaining))
                .replace("{plan}", j.flashcardDay.planSlug)
            );
          } else {
            setQuotaLine(null);
          }
        } else {
          setQuotaLine(null);
        }
      } catch {
        setError(labels.error);
      } finally {
        setLoading(false);
      }
    },
    [labels.error, labels.quotaLine, scopeDeckId, userId]
  );

  async function review(card: DueCard, rating: "again" | "hard" | "good") {
    const uid = userId;
    if (!uid) {
      return;
    }
    setError(null);
    const offline =
      typeof navigator !== "undefined" && !navigator.onLine && typeof indexedDB !== "undefined";
    if (offline) {
      try {
        await enqueueReview({
          clientMutationId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${card.id}`,
          rating,
          userFlashcardId: card.id,
          userId: uid
        });
        setQueueStatus(labels.offlineQueued);
        setPendingOffline((n) => n + 1);
        setCards((current) => current.filter((item) => item.id !== card.id));
        setRevealed(false);
        setImageFlow({ step: "idle" });
        setSessionReviewed((n) => n + 1);
      } catch {
        setError(labels.error);
      }
      return;
    }
    try {
      const response = await learnerApiFetch(`/api/flashcards/reviews/${card.id}`, {
        body: JSON.stringify({ rating, userId: uid }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!response.ok) {
        if (response.status === 403) {
          const body = (await response.json().catch(() => ({}))) as { code?: string };
          if (body.code === "QUOTA_EXCEEDED") {
            setError(labels.quotaExceeded);
            return;
          }
        }
        if (typeof indexedDB !== "undefined") {
          await enqueueReview({
            clientMutationId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${card.id}`,
            rating,
            userFlashcardId: card.id,
            userId: uid
          });
          setQueueStatus(labels.offlineQueued);
          setPendingOffline((n) => n + 1);
          setCards((current) => current.filter((item) => item.id !== card.id));
          setRevealed(false);
          setImageFlow({ step: "idle" });
          return;
        }
        setError(labels.error);
        return;
      }

      const responseData = (await response.json()) as ReviewFeedback & { error?: string };
      if (responseData.error) {
        setError(labels.error);
        return;
      }

      if (rating === "again") {
        setFeedback(responseData);
        clearFeedbackTimer();
        feedbackTimerRef.current = setTimeout(() => {
          setCards((current) => current.filter((item) => item.id !== card.id));
          setRevealed(false);
          setImageFlow({ step: "idle" });
          setFeedback(null);
          setSessionReviewed((n) => n + 1);
          feedbackTimerRef.current = null;
        }, 3000);
      } else {
        setCards((current) => current.filter((item) => item.id !== card.id));
        setRevealed(false);
        setImageFlow({ step: "idle" });
        setFeedback(null);
        setSessionReviewed((n) => n + 1);
      }
    } catch {
      setError(labels.error);
    }
  }

  async function onPickImage(file: File, card: DueCard) {
    const uid = userId;
    if (!uid) {
      return;
    }
    if (!allowedMime.has(file.type)) {
      setImageFlow({ showCors: false, step: "error", userMessage: labels.imageErrorType });
      return;
    }
    if (file.size < 1 || file.size > maxBytes) {
      setImageFlow({ showCors: false, step: "error", userMessage: labels.imageErrorSize });
      return;
    }
    setImageFlow({ step: "uploading" });
    setError(null);
    try {
      const pres = await learnerApiFetch("/api/media/presign-upload", {
        body: JSON.stringify({
          fileName: file.name || "upload.bin",
          mimeType: file.type,
          userId: uid
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!pres.ok) {
        const message = (await pres.text()) || labels.imageError;
        throw new Error(message);
      }
      const { assetId, uploadUrl } = (await pres.json()) as { assetId: string; uploadUrl: string };
      const put = await fetch(uploadUrl, {
        body: file,
        headers: { "Content-Type": file.type },
        method: "PUT"
      });
      if (!put.ok) {
        throw new Error("put_failed");
      }
      setImageFlow({ step: "completing" });
      const done = await learnerApiFetch("/api/media/complete-upload", {
        body: JSON.stringify({ assetId, byteSize: file.size, userId: uid }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!done.ok) {
        const message = (await done.text()) || labels.imageError;
        throw new Error(message);
      }
      setImageFlow({ step: "linking" });
      const link = await learnerApiFetch(`/api/flashcards/cards/${card.card.id}/media`, {
        body: JSON.stringify({ assetId, role: "primary_image", userId: uid }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      if (!link.ok) {
        const message = (await link.text()) || labels.imageError;
        throw new Error(message);
      }
      setImageFlow({ step: "success" });
      await loadDueCards({ resetImageFlow: false });
    } catch (err) {
      const isPut = err instanceof Error && err.message === "put_failed";
      setImageFlow({
        showCors: isPut,
        step: "error",
        userMessage: isPut
          ? labels.imageError
          : err instanceof Error
            ? err.message
            : labels.imageError
      });
    }
  }

  const currentCard = cards[0];
  const imageStatusText = imageFlowLabel(imageFlow.step, labels);
  const canAttachImage =
    Boolean(userId) && Boolean(currentCard) && !feedback && !currentCard?.primaryImage?.readUrl;

  useEffect(() => {
    if (userId) {
      void loadDueCards({ resetImageFlow: true });
    }
  }, [loadDueCards, scopeDeckId, userId]);

  return (
    <div className="space-y-4">
      {scopeDeckId ? (
        <div className="flex flex-col gap-2 rounded-xl border border-leaf/25 bg-leaf-soft/45 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold leading-snug text-ink">{labels.reviewScopeBanner}</p>
          <Link
            className={`${btnSecondary} inline-flex min-h-9 shrink-0 justify-center px-3 text-xs font-bold`}
            href={`/${locale}/flashcards?tab=review`}
          >
            {labels.reviewScopeClearCta}
          </Link>
        </div>
      ) : null}
      <div
        aria-label={labels.compactReviewEyebrow ?? labels.reviewTab}
        className="flex flex-col gap-2 rounded-xl border border-ink/10 bg-paper/50 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
        role="status"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-ink">
          <span className="tabular-nums text-muted">
            {labels.statDueSession}: <strong className="text-ink">{cards.length}</strong>
          </span>
          <span className="hidden text-muted sm:inline" aria-hidden>
            ·
          </span>
          <span className="tabular-nums text-muted">
            {labels.statPendingSync}: <strong className="text-ink">{pendingOffline}</strong>
          </span>
          {quotaLine ? (
            <>
              <span className="hidden text-muted sm:inline" aria-hidden>
                ·
              </span>
              <span className="min-w-0 break-words text-muted">{quotaLine}</span>
            </>
          ) : null}
        </div>
        {pendingOffline > 0 ? (
          <p className="text-xs text-muted">
            {labels.offlinePendingLine.replace("{n}", String(pendingOffline))}
          </p>
        ) : null}
        {queueStatus ? <p className="text-xs font-medium text-ink">{queueStatus}</p> : null}
        {imageFlow.step === "error" ? (
          <p className="text-xs text-sakura" role="alert">
            {imageFlow.userMessage}
            {imageFlow.showCors ? <span> {labels.imageErrorCors}</span> : null}
          </p>
        ) : null}
        <button
          className={`${btnNeutral} ml-auto min-h-9 shrink-0 px-3 text-xs sm:ml-0`}
          disabled={loading || !userId}
          type="button"
          onClick={() => void loadDueCards({ resetImageFlow: true })}
        >
          {labels.refreshDue}
        </button>
      </div>

      {!compact ? (
        <p className="text-sm leading-relaxed text-muted">{labels.sessionFocusHint}</p>
      ) : null}

      {loading ? (
        <div className="space-y-3" aria-busy>
          <LoadingSkeleton className="h-56 max-w-3xl rounded-2xl" />
          <div className="flex gap-2">
            <LoadingSkeleton className="h-10 w-28" />
            <LoadingSkeleton className="h-10 w-28" />
            <LoadingSkeleton className="h-10 w-28" />
          </div>
        </div>
      ) : null}

      {error && !loading ? (
        <ErrorState
          action={
            <Button size="sm" variant="secondary" type="button" onClick={() => void loadDueCards({ resetImageFlow: true })}>
              {labels.refreshDue}
            </Button>
          }
          className="max-w-3xl"
          description={labels.sessionFocusHint}
          title={error}
        />
      ) : null}

      {!currentCard && !loading && !error ? (
        scopeDeckId ? (
          <EmptyState
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link className={`${btnPrimary} min-h-10 px-5`} href={`/${locale}/flashcards?tab=review`}>
                  {labels.reviewScopeClearCta}
                </Link>
                <Link
                  className={`${btnSecondary} min-h-10 px-5`}
                  href={`/${locale}/flashcards/decks/${scopeDeckId}`}
                >
                  {labels.reviewScopeBackToDeckCta}
                </Link>
              </div>
            }
            description={labels.reviewScopeEmptyDescription}
            title={labels.reviewScopeEmptyTitle}
          />
        ) : (
          <EmptyState
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link className={`${btnPrimary} min-h-10 px-5`} href={`/${locale}/search`}>
                  {labels.emptyCtaSearch}
                </Link>
                <Link className={`${btnSecondary} min-h-10 px-5`} href={`/${locale}#daily-japanese`}>
                  {labels.emptyCtaDaily}
                </Link>
              </div>
            }
            description={labels.emptyDescription}
            title={labels.emptyTitle}
          />
        )
      ) : null}

      {currentCard ? (
        <FlashcardInteractiveCard
          answerContent={
            <>
              <h3 className="text-[11px] font-black uppercase tracking-wide text-muted">{labels.answerHeading}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink">{currentCard.card.backText}</p>
            </>
          }
          cardId={currentCard.id}
          comebackContent={
            feedback ? (
              <div className="fc-mentor-enter rounded-xl border border-leaf/25 bg-leaf-soft/60 p-4">
                <p className="text-sm font-bold text-ink">{labels.comebackTitle}</p>
                {feedback.remediation?.sourceType ? (
                  <p className="mt-1 text-xs font-semibold text-muted">
                    {labels.comebackSkill.replace("{skill}", feedback.remediation.sourceType)}
                  </p>
                ) : null}
                <p className="mt-2 text-sm leading-relaxed text-ink">{labels.comebackBody}</p>
                <p className="mt-2 text-xs text-muted">{labels.comebackNext}</p>
              </div>
            ) : null
          }
          compact={compact}
          feedbackActive={Boolean(feedback)}
          frontText={currentCard.card.frontText}
          imageNode={
            currentCard.primaryImage?.readUrl ? (
              <figure className="mb-3 overflow-hidden rounded-xl bg-paper ring-1 ring-ink/8">
                <img
                  alt={labels.imageAlt.replace("{front}", currentCard.card.frontText)}
                  className="h-[200px] max-h-[200px] w-full object-contain"
                  height={200}
                  src={currentCard.primaryImage.readUrl}
                  width={400}
                />
                <figcaption className="sr-only">{currentCard.card.frontText}</figcaption>
              </figure>
            ) : null
          }
          imageUploadNode={
            canAttachImage ? (
              compact ? (
                <details className="rounded-xl border border-dashed border-ink/12 bg-paper/30 ring-1 ring-ink/[0.04]">
                  <summary className="min-h-11 cursor-pointer list-none px-3 py-3 text-xs font-bold text-ink outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden sm:px-4 sm:text-sm">
                    {labels.reviewImageOptionalSummary}
                  </summary>
                  <div className="border-t border-ink/10 px-3 pb-4 pt-2 sm:px-4">
                    <p className="text-[11px] leading-snug text-muted sm:text-xs">{labels.imageHint}</p>
                    <div className="mt-3">
                      <input
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        id={fileInputId}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) {
                            void onPickImage(file, currentCard);
                          }
                        }}
                        type="file"
                      />
                      <label className={`${btnSecondary} min-h-9 cursor-pointer text-xs`} htmlFor={fileInputId}>
                        {labels.imageUploadLabel}
                      </label>
                    </div>
                    {imageStatusText ? (
                      <p aria-live="polite" className="mt-2 text-[11px] font-medium text-muted" role="status">
                        {imageStatusText}
                      </p>
                    ) : null}
                  </div>
                </details>
              ) : (
                <div className="rounded-xl border border-dashed border-ink/15 bg-paper/40 p-3 sm:p-4">
                  <h3 className="text-xs font-bold text-ink sm:text-sm">{labels.imageSectionTitle}</h3>
                  <p className="mt-1 text-[11px] text-muted sm:text-xs">{labels.imageHint}</p>
                  <div className="mt-3">
                    <input
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      id={fileInputId}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) {
                          void onPickImage(file, currentCard);
                        }
                      }}
                      type="file"
                    />
                    <label className={`${btnSecondary} min-h-9 cursor-pointer text-xs`} htmlFor={fileInputId}>
                      {labels.imageUploadLabel}
                    </label>
                  </div>
                  {imageStatusText ? (
                    <p aria-live="polite" className="mt-2 text-[11px] font-medium text-muted" role="status">
                      {imageStatusText}
                    </p>
                  ) : null}
                </div>
              )
            ) : null
          }
          mentorLabels={{
            mentorAgainEmoji: labels.mentorAgainEmoji,
            mentorAgainText: labels.mentorAgainText,
            mentorGoodEmoji: labels.mentorGoodEmoji,
            mentorGoodText: labels.mentorGoodText,
            mentorHardEmoji: labels.mentorHardEmoji,
            mentorHardText: labels.mentorHardText,
            mentorMilestone5: labels.mentorMilestone5,
            mentorMilestone10: labels.mentorMilestone10,
            mentorMilestone25: labels.mentorMilestone25,
            mentorName: labels.mentorName,
            streakLabel: labels.streakLabel,
          }}
          onRate={(rating) => void review(currentCard, rating)}
          onReveal={() => setRevealed(true)}
          phaseLabel={!revealed ? labels.reviewPhaseQuestion : labels.reviewPhaseAnswer}
          ratingLabels={{ again: labels.again, good: labels.good, hard: labels.hard }}
          reading={currentCard.card.reading}
          revealed={revealed}
          revealLabel={labels.reveal}
          sessionReviewed={sessionReviewed}
          sessionTotal={sessionInitialTotal}
        />
      ) : null}

      {!compact ? (
        <aside className="max-w-3xl space-y-3 rounded-2xl border border-ink/10 bg-paper/50 p-4">
          <p className="text-sm font-bold text-ink">{labels.title}</p>
          <p className="text-xs text-muted">{labels.subtitle}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-ink/8 bg-surface p-3">
              <p className="text-[11px] font-semibold text-muted">{labels.statDueSession}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-ink">{cards.length}</p>
            </div>
            <div className="rounded-xl border border-ink/8 bg-surface p-3">
              <p className="text-[11px] font-semibold text-muted">{labels.statPendingSync}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-ink">{pendingOffline}</p>
            </div>
          </div>
          {quotaLine ? <p className="text-xs leading-relaxed text-muted">{quotaLine}</p> : null}
        </aside>
      ) : null}
    </div>
  );
}
