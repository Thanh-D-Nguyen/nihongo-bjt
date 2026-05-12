"use client";

import type { BookmarkTargetType } from "@nihongo-bjt/shared";
import { useCallback, useEffect, useState } from "react";

import { learnerApiFetch } from "../../../lib/learner-api";
import { useKeycloakAuth } from "../../../components/auth/keycloak-auth-provider";

/* ── Icons ──────────────────────────────────── */

function BookmarkIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg aria-hidden className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 2h12a2 2 0 0 1 2 2v18l-8-4-8 4V4a2 2 0 0 1 2-2z" />
    </svg>
  ) : (
    <svg aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
      <path d="M6 4h12a2 2 0 0 1 2 2v16l-7-3.5L6 22V6a2 2 0 0 1 2-2z" strokeLinejoin="round" />
    </svg>
  );
}

function FlashcardIcon() {
  return (
    <svg aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
      <rect height="14" rx="2" width="16" x="3" y="7" />
      <path d="M7 4h10a2 2 0 0 1 2 2v2" strokeLinecap="round" />
      <path d="M12 12v4M10 14h4" strokeLinecap="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg aria-hidden className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
    </svg>
  );
}

/* ── Labels ──────────────────────────────────── */

export interface ContentActionLabels {
  bookmark: string;
  bookmarked: string;
  addFlashcard: string;
  addedFlashcard: string;
  signInHint: string;
}

/* ── Component ──────────────────────────────── */

export function ContentActions({
  contentId,
  frontText,
  backText,
  labels,
  targetType
}: {
  contentId: string;
  frontText: string;
  backText: string;
  labels: ContentActionLabels;
  targetType: BookmarkTargetType;
}) {
  const auth = useKeycloakAuth();
  const userId = auth.userId ?? "";
  const isLoggedIn = Boolean(userId);

  const [bookmarked, setBookmarked] = useState(false);
  const [bmLoading, setBmLoading] = useState(false);
  const [fcAdded, setFcAdded] = useState(false);
  const [fcLoading, setFcLoading] = useState(false);

  // Check bookmark status
  useEffect(() => {
    if (!isLoggedIn || !contentId) return;
    let cancelled = false;
    void learnerApiFetch(`/api/bookmarks/check/${targetType}/${encodeURIComponent(contentId)}`)
      .then(async (r) => {
        if (!r.ok || cancelled) return;
        const d = (await r.json()) as { bookmarked?: boolean };
        setBookmarked(Boolean(d.bookmarked));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [contentId, targetType, isLoggedIn]);

  const toggleBookmark = useCallback(async () => {
    if (!isLoggedIn || bmLoading) return;
    setBmLoading(true);
    try {
      const r = await learnerApiFetch(`/api/bookmarks/${targetType}/${encodeURIComponent(contentId)}`, { method: "POST" });
      if (r.ok) {
        const d = (await r.json()) as { bookmarked?: boolean };
        setBookmarked(Boolean(d.bookmarked));
      }
    } catch { /* keep state */ } finally {
      setBmLoading(false);
    }
  }, [bmLoading, contentId, targetType, isLoggedIn]);

  const addToFlashcard = useCallback(async () => {
    if (!isLoggedIn || fcLoading || fcAdded) return;
    setFcLoading(true);
    try {
      const r = await learnerApiFetch("/api/flashcards/cards/from-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          contentId,
          sourceType: targetType,
          frontText,
          backText
        })
      });
      if (r.ok) setFcAdded(true);
    } catch { /* keep state */ } finally {
      setFcLoading(false);
    }
  }, [fcLoading, fcAdded, contentId, targetType, userId, frontText, backText, isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <p className="text-[11px] text-[#9CA3AF]">{labels.signInHint}</p>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        aria-label={bookmarked ? labels.bookmarked : labels.bookmark}
        aria-pressed={bookmarked}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
          bookmarked
            ? "border-[#F87171]/30 bg-[#FEF2F2] text-[#DC2626]"
            : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]"
        }`}
        disabled={bmLoading}
        onClick={() => void toggleBookmark()}
        type="button"
      >
        {bmLoading ? <SpinnerIcon /> : <BookmarkIcon filled={bookmarked} />}
        {bookmarked ? labels.bookmarked : labels.bookmark}
      </button>

      <button
        aria-label={fcAdded ? labels.addedFlashcard : labels.addFlashcard}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
          fcAdded
            ? "border-[#22C55E]/30 bg-[#F0FDF4] text-[#16A34A]"
            : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]"
        }`}
        disabled={fcLoading || fcAdded}
        onClick={() => void addToFlashcard()}
        type="button"
      >
        {fcLoading ? <SpinnerIcon /> : <FlashcardIcon />}
        {fcAdded ? labels.addedFlashcard : labels.addFlashcard}
      </button>
    </div>
  );
}
