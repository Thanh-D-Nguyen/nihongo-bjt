"use client";

import { useCallback, useEffect, useId, useState } from "react";

import { Card, CardContent, PageHeader } from "@nihongo-bjt/ui";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import {
  drainForUser,
  enqueueReview,
  queueSizeForUser
} from "../../../../lib/offline-review-queue";
import { learnerApiFetch } from "../../../../lib/learner-api";

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

interface FlashcardLabels {
  again: string;
  empty: string;
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
  load: string;
  loading: string;
  offlineFlushFail: string;
  offlineFlushOk: string;
  offlinePendingLine: string;
  offlineQueued: string;
  offlineSyncing: string;
  placeholder: string;
  reveal: string;
  subtitle: string;
  title: string;
  quotaExceeded: string;
  quotaLine: string;
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

export function FlashcardsClient({ labels }: { labels: FlashcardLabels }) {
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
  const [feedbackDelay, setFeedbackDelay] = useState<NodeJS.Timeout | null>(null);
  const { userId } = useKeycloakAuth();

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
        const response = await learnerApiFetch(
          `/api/flashcards/reviews/due?userId=${encodeURIComponent(uid)}&limit=10`
        );
        if (!response.ok) {
          throw new Error("Due review request failed");
        }
        setCards((await response.json()) as DueCard[]);
        setRevealed(false);
        const sum = await learnerApiFetch(
          `/api/learner/monetization/summary?userId=${encodeURIComponent(uid)}`
        );
        if (sum.ok) {
          const j = (await sum.json()) as {
            flashcardDay: {
              limit: number;
              planSlug: string;
              remaining: number;
              used: number;
              windowKey: string;
            };
          };
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
      } catch {
        setError(labels.error);
      } finally {
        setLoading(false);
      }
    },
    [labels.error, labels.quotaLine, userId]
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
      
      // Show feedback for "again" rating
      if (rating === "again") {
        setFeedback(responseData);
        // Clear any pending feedback delay
        if (feedbackDelay) clearTimeout(feedbackDelay);
        // Move to next card after 3 seconds
        const delay = setTimeout(() => {
          setCards((current) => current.filter((item) => item.id !== card.id));
          setRevealed(false);
          setImageFlow({ step: "idle" });
          setFeedback(null);
        }, 3000);
        setFeedbackDelay(delay);
      } else {
        // Immediately move to next card for "hard" and "good"
        setCards((current) => current.filter((item) => item.id !== card.id));
        setRevealed(false);
        setImageFlow({ step: "idle" });
        setFeedback(null);
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
  const showImageSection = Boolean(userId) && currentCard && !feedback;

  useEffect(() => {
    if (userId) {
      void loadDueCards({ resetImageFlow: true });
    }
    return () => {
      if (feedbackDelay) clearTimeout(feedbackDelay);
    };
  }, [loadDueCards, userId, feedbackDelay]);

  return (
    <main className="w-full space-y-6 pb-12">
      <PageHeader
        actions={
          <button
            className="rounded-xl border border-ink/15 bg-ink px-4 py-2 text-sm font-semibold text-surface hover:bg-ink/90 disabled:opacity-50"
            disabled={loading || !userId}
            type="button"
            onClick={() => void loadDueCards({ resetImageFlow: true })}
          >
            {labels.load}
          </button>
        }
        description={labels.subtitle}
        eyebrow={labels.eyebrow}
        title={labels.title}
      />
      <Card className="border-ink/10 shadow-sm">
        <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            {loading ? <p>{labels.loading}</p> : null}
            {pendingOffline > 0 ? (
              <p className="text-muted small" role="status">
                {labels.offlinePendingLine.replace("{n}", String(pendingOffline))}
              </p>
            ) : null}
            {queueStatus ? (
              <p className="small" role="status">
                {queueStatus}
              </p>
            ) : null}
            {quotaLine ? <p className="text-muted small">{quotaLine}</p> : null}
            {error ? <p role="alert">{error}</p> : null}
            {imageFlow.step === "error" ? (
              <p role="alert">
                {imageFlow.userMessage}
                {imageFlow.showCors ? <span> {labels.imageErrorCors}</span> : null}
              </p>
            ) : null}
            {!currentCard && !loading && !error ? <p>{labels.empty}</p> : null}
            {currentCard ? (
              <article className="rounded-2xl border border-ink/10 bg-paper/60 p-5">
                {currentCard.primaryImage?.readUrl ? (
                  <figure className="card-image-wrap">
                    <img
                      alt={labels.imageAlt.replace("{front}", currentCard.card.frontText)}
                      className="card-image"
                      height={220}
                      src={currentCard.primaryImage.readUrl}
                      width={360}
                    />
                    <figcaption className="sr-only">{currentCard.card.frontText}</figcaption>
                  </figure>
                ) : null}
                <strong className="jp-text block text-3xl font-semibold text-ink sm:text-4xl">
                  {currentCard.card.frontText}
                </strong>
                {currentCard.card.reading ? (
                  <small className="mt-2 block text-sm text-muted">
                    {currentCard.card.reading}
                  </small>
                ) : null}
                {revealed ? (
                  <p className="mt-5 rounded-xl border border-ink/10 bg-surface p-4 text-sm leading-relaxed text-ink">
                    {currentCard.card.backText}
                  </p>
                ) : null}
                {showImageSection ? (
                  <div className="card-media-block">
                    <h3 className="section-title">{labels.imageSectionTitle}</h3>
                    <p className="text-muted small">{labels.imageHint}</p>
                    <div className="actions compact">
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
                      <label className="secondary-button" htmlFor={fileInputId}>
                        {labels.imageUploadLabel}
                      </label>
                    </div>
                    {imageStatusText ? (
                      <p aria-live="polite" className="image-flow-status" role="status">
                        {imageStatusText}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {feedback ? (
                  <div className="mt-5 rounded-xl border border-green-300 bg-green-50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-green-900">Let's practice this more!</p>
                        {feedback.remediation?.sourceType && (
                          <p className="mt-1 text-xs text-green-700">
                            Skill: <span className="font-medium">{feedback.remediation.sourceType}</span>
                          </p>
                        )}
                        <p className="mt-2 text-sm leading-relaxed text-green-800">
                          This card has been marked for comeback review. You can review similar cards later to strengthen your knowledge.
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-green-600">Next card loading...</p>
                  </div>
                ) : null}
                <div className="actions">
                  {!revealed && !feedback ? (
                    <button
                      className="secondary-button"
                      onClick={() => setRevealed(true)}
                      type="button"
                    >
                      {labels.reveal}
                    </button>
                  ) : !feedback ? (
                    <>
                      <button
                        className="secondary-button"
                        onClick={() => void review(currentCard, "again")}
                        type="button"
                      >
                        {labels.again}
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => void review(currentCard, "hard")}
                        type="button"
                      >
                        {labels.hard}
                      </button>
                      <button
                        className="primary"
                        onClick={() => void review(currentCard, "good")}
                        type="button"
                      >
                        {labels.good}
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            ) : null}
          </div>
          <aside className="space-y-3 rounded-2xl border border-ink/10 bg-paper/50 p-4 lg:self-start">
            <p className="text-sm font-semibold text-ink">{labels.title}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-surface p-3">
                <p className="text-xs text-muted">{labels.load}</p>
                <p className="text-xl font-semibold text-ink">{cards.length}</p>
              </div>
              <div className="rounded-xl bg-surface p-3">
                <p className="text-xs text-muted">{labels.offlineSyncing}</p>
                <p className="text-xl font-semibold text-ink">{pendingOffline}</p>
              </div>
            </div>
            {quotaLine ? <p className="text-xs leading-relaxed text-muted">{quotaLine}</p> : null}
          </aside>
        </CardContent>
      </Card>
    </main>
  );
}
