"use client";

import type { BookmarkTargetType } from "@nihongo-bjt/shared";
import { useCallback, useEffect, useRef, useState } from "react";

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

function PlusIcon() {
  return (
    <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
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
  chooseDeck?: string;
  createDeck?: string;
  newDeckPlaceholder?: string;
  nDecks?: string;
}

/* ── Deck type ───────────────────────────────── */

interface DeckItem {
  id: string;
  titleVi: string | null;
  titleJa: string | null;
  _count?: { cards: number };
}

/* ── Deck Picker Popover ─────────────────────── */

function DeckPicker({
  labels,
  onClose,
  onSelect
}: {
  labels: ContentActionLabels;
  onClose: () => void;
  onSelect: (deckId: string) => void;
}) {
  const auth = useKeycloakAuth();
  const userId = auth.userId ?? "";
  const [decks, setDecks] = useState<DeckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await learnerApiFetch(`/api/flashcards/decks?userId=${userId}&limit=50`);
        if (r.ok) {
          const data = (await r.json()) as DeckItem[];
          setDecks(data);
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const handleCreateDeck = async () => {
    const name = newName.trim();
    if (!name || submitting) return;
    setSubmitting(true);
    try {
      const r = await learnerApiFetch("/api/flashcards/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, titleVi: name })
      });
      if (r.ok) {
        const deck = (await r.json()) as DeckItem;
        onSelect(deck.id);
      }
    } catch { /* ignore */ } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={popoverRef}
      className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-[#E5E7EB] bg-white shadow-xl shadow-black/8 animate-in fade-in slide-in-from-top-1 duration-150"
    >
      <div className="border-b border-[#F3F4F6] px-3 py-2.5">
        <p className="text-xs font-semibold text-[#374151]">
          {labels.chooseDeck ?? "Chọn bộ thẻ"}
        </p>
      </div>

      <div className="max-h-48 overflow-y-auto p-1.5">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <SpinnerIcon />
          </div>
        ) : decks.length === 0 && !creating ? (
          <p className="px-2 py-3 text-center text-xs text-[#9CA3AF]">
            {labels.nDecks ?? "Chưa có bộ thẻ nào"}
          </p>
        ) : (
          decks.map((deck) => (
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[#374151] transition-colors hover:bg-[#F3F4F6] active:bg-[#E5E7EB]"
              key={deck.id}
              onClick={() => onSelect(deck.id)}
              type="button"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#EFF6FF] text-[10px] font-bold text-[#3B82F6]">
                {deck._count?.cards ?? 0}
              </span>
              <span className="truncate font-medium">
                {deck.titleVi || deck.titleJa || "Untitled"}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Create new deck */}
      <div className="border-t border-[#F3F4F6] p-2">
        {creating ? (
          <div className="flex gap-1.5">
            <input
              autoFocus
              className="flex-1 rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-xs text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/30"
              disabled={submitting}
              maxLength={60}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateDeck();
                if (e.key === "Escape") { setCreating(false); setNewName(""); }
              }}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={labels.newDeckPlaceholder ?? "Tên bộ thẻ mới..."}
              value={newName}
            />
            <button
              className="inline-flex items-center justify-center rounded-lg bg-[#3B82F6] px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#2563EB] disabled:opacity-50"
              disabled={!newName.trim() || submitting}
              onClick={() => void handleCreateDeck()}
              type="button"
            >
              {submitting ? <SpinnerIcon /> : <CheckIcon />}
            </button>
          </div>
        ) : (
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[#3B82F6] transition-colors hover:bg-[#EFF6FF]"
            onClick={() => setCreating(true)}
            type="button"
          >
            <PlusIcon />
            {labels.createDeck ?? "Tạo bộ thẻ mới"}
          </button>
        )}
      </div>
    </div>
  );
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
  const [showPicker, setShowPicker] = useState(false);

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

  const addToFlashcard = useCallback(async (deckId: string) => {
    if (!isLoggedIn || fcLoading || fcAdded) return;
    setFcLoading(true);
    setShowPicker(false);
    try {
      const r = await learnerApiFetch("/api/flashcards/cards/from-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          sourceId: contentId,
          sourceType: targetType,
          deckId,
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
    <div className="relative flex gap-2">
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
        onClick={() => !fcAdded && setShowPicker((v) => !v)}
        type="button"
      >
        {fcLoading ? <SpinnerIcon /> : <FlashcardIcon />}
        {fcAdded ? labels.addedFlashcard : labels.addFlashcard}
      </button>

      {showPicker && (
        <DeckPicker
          labels={labels}
          onClose={() => setShowPicker(false)}
          onSelect={(deckId) => void addToFlashcard(deckId)}
        />
      )}
    </div>
  );
}
