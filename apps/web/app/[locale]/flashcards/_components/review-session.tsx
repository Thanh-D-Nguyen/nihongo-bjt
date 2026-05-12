"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { enqueueReview } from "../../../../lib/offline-review-queue";
import { learnerApiFetch } from "../../../../lib/learner-api";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

interface DueCard {
  card: { backText: string; frontText: string; id: string; reading: string | null };
  cardId: string;
  id: string;
  primaryImage: { assetId: string; mimeType: string; readUrl: string | null } | null;
  state: string;
}

type Phase = "loading" | "entry" | "review" | "summary";
type Mode = "flip" | "type" | "match";
type Rating = "again" | "hard" | "good";

export interface ReviewSessionLabels {
  entryTitle: string;
  entrySubtitle: string;
  startSession: string;
  exitSession: string;
  noCards: string;
  noCardsDesc: string;
  flipPrompt: string;
  typePrompt: string;
  typePlaceholder: string;
  typeSubmit: string;
  matchPrompt: string;
  again: string;
  hard: string;
  good: string;
  comboLabel: string;
  correct: string;
  incorrect: string;
  correctAnswer: string;
  summaryTitle: string;
  summaryGreat: string;
  summaryCards: string;
  summaryAccuracy: string;
  summaryCombo: string;
  summaryTime: string;
  reviewMore: string;
  backToLibrary: string;
  loadingCards: string;
  errorLoading: string;
  retry: string;
  keyboardHint: string;
  sessionOf: string;
  tapToReveal: string;
  reading: string;
}

interface Stats {
  total: number;
  good: number;
  hard: number;
  again: number;
  maxCombo: number;
  startTime: number;
}

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

function pickMode(index: number, totalCards: number): Mode {
  if (totalCards < 4) return index % 2 === 0 ? "flip" : "type";
  const modes: Mode[] = ["flip", "type", "match"];
  return modes[index % 3];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateOptions(current: DueCard, all: DueCard[]): string[] {
  const correct = current.card.backText;
  const others = all
    .filter((c) => c.id !== current.id && c.card.backText !== correct)
    .map((c) => c.card.backText);
  const distractors = shuffle(others).slice(0, 3);
  while (distractors.length < 3) distractors.push("—");
  return shuffle([correct, ...distractors]);
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

/* ═══════════════════════════════════════════════════════
   Inline Keyframes (injected once)
   ═══════════════════════════════════════════════════════ */

const STYLE_ID = "review-session-keyframes";

function ensureKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes rs-confetti {
      0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
      100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
    }
    @keyframes rs-combo-pop {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.2); }
    }
    @keyframes rs-card-enter {
      0% { opacity: 0; transform: scale(0.92) translateY(16px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes rs-glow-pulse {
      0%, 100% { box-shadow: 0 0 20px rgba(16,185,129,0.15); }
      50% { box-shadow: 0 0 40px rgba(16,185,129,0.3); }
    }
    @keyframes rs-flip-in {
      0% { transform: rotateY(90deg); opacity: 0; }
      100% { transform: rotateY(0deg); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

/* ═══════════════════════════════════════════════════════
   Progress Ring
   ═══════════════════════════════════════════════════════ */

function ProgressRing({
  value,
  size = 52,
  label,
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(Math.max(value, 0), 100) / 100) * circ;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="drop-shadow-lg" height={size} width={size}>
        <circle
          className="text-white/10"
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={r}
          stroke="currentColor"
          strokeWidth={4}
        />
        <circle
          className="text-emerald-400 transition-all duration-700 ease-out"
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={r}
          stroke="currentColor"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={4}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {label ? (
        <span className="absolute text-[11px] font-bold tabular-nums text-white/80">{label}</span>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Combo Display
   ═══════════════════════════════════════════════════════ */

function ComboDisplay({ combo }: { combo: number }) {
  if (combo < 2) return null;
  return (
    <div
      className="flex items-center gap-1.5"
      style={{ animation: "rs-combo-pop 0.4s ease-out" }}
      key={combo}
    >
      <span className="text-2xl" aria-hidden>
        🔥
      </span>
      <span className="text-lg font-black tabular-nums text-amber-400">x{combo}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Confetti
   ═══════════════════════════════════════════════════════ */

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        size: 6 + Math.random() * 6,
        color: ["#10B981", "#F59E0B", "#3B82F6", "#EC4899", "#8B5CF6"][
          Math.floor(Math.random() * 5)
        ],
        dur: 1.5 + Math.random() * 1.5,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.left}%`,
            top: -20,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            animation: `rs-confetti ${p.dur}s ${p.delay}s ease-out forwards`,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Card wrapper (shared dark card shell)
   ═══════════════════════════════════════════════════════ */

function ReviewCard({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className="relative mx-auto w-full max-w-lg cursor-pointer select-none overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl backdrop-blur-xl transition-transform hover:scale-[1.01] sm:p-10"
      style={{ animation: "rs-card-enter 0.4s ease-out", animationFillMode: "both" }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Flip Mode
   ═══════════════════════════════════════════════════════ */

function FlipReview({
  card,
  labels,
  flipped,
  onFlip,
}: {
  card: DueCard;
  labels: ReviewSessionLabels;
  flipped: boolean;
  onFlip: () => void;
}) {
  return (
    <ReviewCard onClick={!flipped ? onFlip : undefined}>
      <div className="min-h-[200px] flex flex-col items-center justify-center gap-4 text-center">
        {/* Front: Japanese */}
        <p className="text-4xl font-black leading-tight text-white sm:text-5xl">
          {card.card.frontText}
        </p>
        {card.card.reading ? (
          <p className="text-lg font-medium text-emerald-300/80">{card.card.reading}</p>
        ) : null}

        {!flipped ? (
          <p className="mt-4 text-sm text-white/40">{labels.tapToReveal}</p>
        ) : (
          <div
            className="mt-6 w-full border-t border-white/10 pt-6"
            style={{ animation: "rs-flip-in 0.35s ease-out" }}
          >
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400/70">
              {labels.correctAnswer}
            </p>
            <p className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              {card.card.backText}
            </p>
          </div>
        )}
      </div>
    </ReviewCard>
  );
}

/* ═══════════════════════════════════════════════════════
   Type Mode
   ═══════════════════════════════════════════════════════ */

function TypeReview({
  card,
  labels,
  revealed,
  onReveal,
}: {
  card: DueCard;
  labels: ReviewSessionLabels;
  revealed: boolean;
  onReveal: (typed: string) => void;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    onReveal(input.trim());
  };

  return (
    <ReviewCard>
      <div className="min-h-[200px] flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-4xl font-black leading-tight text-white sm:text-5xl">
          {card.card.frontText}
        </p>
        {card.card.reading ? (
          <p className="text-lg font-medium text-emerald-300/80">{card.card.reading}</p>
        ) : null}

        {!revealed ? (
          <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
            <label className="sr-only" htmlFor="rs-type-input">
              {labels.typePrompt}
            </label>
            <input
              ref={inputRef}
              id="rs-type-input"
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-center text-lg font-semibold text-white placeholder:text-white/30 outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/30"
              placeholder={labels.typePlaceholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <button
              className="rounded-xl bg-emerald-500/20 px-6 py-2.5 text-sm font-bold text-emerald-300 transition-colors hover:bg-emerald-500/30"
              onClick={submit}
              type="button"
            >
              {labels.typeSubmit}
            </button>
          </div>
        ) : (
          <div
            className="mt-6 w-full space-y-3 border-t border-white/10 pt-6"
            style={{ animation: "rs-flip-in 0.35s ease-out" }}
          >
            {input ? (
              <p className="text-base text-white/50">
                <span className="text-white/30">{labels.typePrompt}: </span>
                <span className="font-semibold text-white/70">{input}</span>
              </p>
            ) : null}
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400/70">
              {labels.correctAnswer}
            </p>
            <p className="text-2xl font-bold text-white sm:text-3xl">{card.card.backText}</p>
          </div>
        )}
      </div>
    </ReviewCard>
  );
}

/* ═══════════════════════════════════════════════════════
   Match Mode
   ═══════════════════════════════════════════════════════ */

function MatchReview({
  card,
  options,
  labels,
  onAnswer,
}: {
  card: DueCard;
  options: string[];
  labels: ReviewSessionLabels;
  onAnswer: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const correct = card.card.backText;
  const isCorrect = selected === correct;

  const handleSelect = (opt: string) => {
    if (selected) return;
    setSelected(opt);
    setTimeout(() => onAnswer(opt === correct), 900);
  };

  return (
    <ReviewCard>
      <div className="min-h-[200px] flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-white/40">
          {labels.matchPrompt}
        </p>
        <p className="text-4xl font-black leading-tight text-white sm:text-5xl">
          {card.card.frontText}
        </p>
        {card.card.reading ? (
          <p className="text-lg font-medium text-emerald-300/80">{card.card.reading}</p>
        ) : null}

        <div className="mt-6 grid w-full max-w-sm grid-cols-1 gap-2.5 sm:grid-cols-2">
          {options.map((opt) => {
            let bg = "bg-white/10 hover:bg-white/15 border-white/15";
            if (selected) {
              if (opt === correct) bg = "bg-emerald-500/25 border-emerald-400/50";
              else if (opt === selected) bg = "bg-red-500/25 border-red-400/50";
              else bg = "bg-white/5 border-white/10 opacity-40";
            }
            return (
              <button
                key={opt}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold text-white transition-all ${bg}`}
                onClick={() => handleSelect(opt)}
                disabled={selected !== null}
                type="button"
              >
                {opt}
              </button>
            );
          })}
        </div>

        {selected ? (
          <p
            className={`mt-3 text-sm font-bold ${isCorrect ? "text-emerald-400" : "text-red-400"}`}
            style={{ animation: "rs-flip-in 0.25s ease-out" }}
          >
            {isCorrect ? labels.correct : labels.incorrect}
          </p>
        ) : null}
      </div>
    </ReviewCard>
  );
}

/* ═══════════════════════════════════════════════════════
   Rating Buttons
   ═══════════════════════════════════════════════════════ */

function RatingButtons({
  labels,
  onRate,
}: {
  labels: ReviewSessionLabels;
  onRate: (r: Rating) => void;
}) {
  return (
    <div
      className="mt-8 flex items-center justify-center gap-3"
      style={{ animation: "rs-card-enter 0.3s ease-out 0.1s both" }}
    >
      <button
        className="min-w-[80px] rounded-2xl border border-red-400/30 bg-red-500/15 px-5 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/25"
        onClick={() => onRate("again")}
        type="button"
      >
        {labels.again} 😅
      </button>
      <button
        className="min-w-[80px] rounded-2xl border border-amber-400/30 bg-amber-500/15 px-5 py-3 text-sm font-bold text-amber-300 transition hover:bg-amber-500/25"
        onClick={() => onRate("hard")}
        type="button"
      >
        {labels.hard} 🤔
      </button>
      <button
        className="min-w-[80px] rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-5 py-3 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/25"
        onClick={() => onRate("good")}
        type="button"
      >
        {labels.good} 👍
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Entry Screen
   ═══════════════════════════════════════════════════════ */

function EntryScreen({
  dueCount,
  labels,
  onStart,
  onExit,
}: {
  dueCount: number;
  labels: ReviewSessionLabels;
  onStart: () => void;
  onExit: () => void;
}) {
  const hasCards = dueCount > 0;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <div
        className="flex h-28 w-28 items-center justify-center rounded-full bg-emerald-500/15 shadow-lg shadow-emerald-500/10"
        style={{ animation: "rs-glow-pulse 3s ease-in-out infinite" }}
      >
        <span className="text-6xl" aria-hidden>
          {hasCards ? "🧠" : "🎉"}
        </span>
      </div>

      <div>
        <h2 className="text-3xl font-black text-white sm:text-4xl">
          {hasCards ? labels.entryTitle : labels.noCards}
        </h2>
        <p className="mt-3 text-lg text-white/60">
          {hasCards
            ? labels.entrySubtitle.replace("{n}", String(dueCount))
            : labels.noCardsDesc}
        </p>
      </div>

      {hasCards ? (
        <button
          className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-10 py-4 text-lg font-black text-white shadow-xl shadow-emerald-500/25 transition-all hover:scale-105 hover:shadow-emerald-500/40 active:scale-[0.98]"
          onClick={onStart}
          type="button"
        >
          {labels.startSession} →
        </button>
      ) : null}

      <button
        className="text-sm font-semibold text-white/40 underline-offset-4 transition hover:text-white/60 hover:underline"
        onClick={onExit}
        type="button"
      >
        {labels.exitSession}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Summary Screen
   ═══════════════════════════════════════════════════════ */

function SummaryScreen({
  stats,
  labels,
  onReviewMore,
  onExit,
}: {
  stats: Stats;
  labels: ReviewSessionLabels;
  onReviewMore: () => void;
  onExit: () => void;
}) {
  const elapsed = Date.now() - stats.startTime;
  const accuracy = stats.total > 0 ? Math.round((stats.good / stats.total) * 100) : 0;
  const showConfetti = accuracy >= 70;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      {showConfetti ? <Confetti /> : null}

      <div>
        <h2 className="text-3xl font-black text-white sm:text-4xl">
          {labels.summaryTitle} 🎉
        </h2>
        <p className="mt-2 text-lg text-white/60">{labels.summaryGreat}</p>
      </div>

      <div className="grid w-full max-w-md grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { value: String(stats.total), label: labels.summaryCards, color: "text-white" },
          { value: `${accuracy}%`, label: labels.summaryAccuracy, color: accuracy >= 70 ? "text-emerald-400" : "text-amber-400" },
          { value: `x${stats.maxCombo}`, label: labels.summaryCombo, color: "text-amber-400" },
          { value: formatTime(elapsed), label: labels.summaryTime, color: "text-white/80" },
        ].map((s) => (
          <div
            key={s.label}
            className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
          >
            <span className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</span>
            <span className="text-xs font-semibold text-white/40">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Rating breakdown bar */}
      {stats.total > 0 ? (
        <div className="flex w-full max-w-xs gap-1 overflow-hidden rounded-full">
          {stats.good > 0 ? (
            <div
              className="h-2.5 bg-emerald-500 transition-all"
              style={{ width: `${(stats.good / stats.total) * 100}%` }}
            />
          ) : null}
          {stats.hard > 0 ? (
            <div
              className="h-2.5 bg-amber-500 transition-all"
              style={{ width: `${(stats.hard / stats.total) * 100}%` }}
            />
          ) : null}
          {stats.again > 0 ? (
            <div
              className="h-2.5 bg-red-500 transition-all"
              style={{ width: `${(stats.again / stats.total) * 100}%` }}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3.5 text-base font-bold text-white shadow-lg transition hover:scale-105 active:scale-[0.98]"
          onClick={onReviewMore}
          type="button"
        >
          {labels.reviewMore}
        </button>
        <button
          className="rounded-2xl border border-white/15 bg-white/[0.06] px-8 py-3.5 text-base font-bold text-white/70 transition hover:bg-white/10"
          onClick={onExit}
          type="button"
        >
          {labels.backToLibrary}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Main: ReviewSession
   ═══════════════════════════════════════════════════════ */

export function ReviewSession({
  labels,
  locale,
  scopeDeckId,
  onExit,
}: {
  labels: ReviewSessionLabels;
  locale: string;
  scopeDeckId?: string | null;
  onExit: () => void;
}) {
  const { userId } = useKeycloakAuth();

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<DueCard[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [mode, setMode] = useState<Mode>("flip");
  const [flipped, setFlipped] = useState(false);
  const [typeRevealed, setTypeRevealed] = useState(false);
  const [matchOptions, setMatchOptions] = useState<string[]>([]);
  const [combo, setCombo] = useState(0);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    good: 0,
    hard: 0,
    again: 0,
    maxCombo: 0,
    startTime: Date.now(),
  });
  // Track reviewed card ids so we don't re-rate
  const reviewedIds = useRef(new Set<string>());

  // Ensure CSS keyframes are injected
  useEffect(() => {
    ensureKeyframes();
  }, []);

  /* ── Fetch due cards ── */
  const fetchCards = useCallback(async () => {
    if (!userId) return [];
    const params = new URLSearchParams({ limit: "50", userId });
    if (scopeDeckId) params.set("deckId", scopeDeckId);
    const res = await learnerApiFetch(`/api/flashcards/reviews/due?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as DueCard[];
    return Array.isArray(data) ? data : [];
  }, [userId, scopeDeckId]);

  /* ── Initial load ── */
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setPhase("loading");
    fetchCards()
      .then((loaded) => {
        if (cancelled) return;
        // Filter out any already-reviewed cards
        const fresh = loaded.filter((c) => !reviewedIds.current.has(c.id));
        setCards(fresh);
        setTotalDue(fresh.length);
        setPhase("entry");
      })
      .catch(() => {
        if (!cancelled) setError(labels.errorLoading);
        setPhase("entry");
      });
    return () => { cancelled = true; };
  }, [userId, fetchCards, labels.errorLoading]);

  /* ── Start session ── */
  const startSession = useCallback(() => {
    if (cards.length === 0) return;
    const m = pickMode(0, cards.length);
    setMode(m);
    setCurrentIdx(0);
    setFlipped(false);
    setTypeRevealed(false);
    if (m === "match") setMatchOptions(generateOptions(cards[0], cards));
    setStats({ total: 0, good: 0, hard: 0, again: 0, maxCombo: 0, startTime: Date.now() });
    setCombo(0);
    setPhase("review");
  }, [cards]);

  /* ── Submit rating ── */
  const submitRating = useCallback(
    async (rating: Rating) => {
      const card = cards[currentIdx];
      if (!card || !userId) return;

      // Update stats
      setStats((prev) => {
        const next = { ...prev, total: prev.total + 1, [rating]: prev[rating] + 1 };
        const newCombo = rating === "good" ? combo + 1 : rating === "hard" ? combo : 0;
        next.maxCombo = Math.max(next.maxCombo, newCombo);
        return next;
      });

      // Update combo
      if (rating === "good") {
        setCombo((c) => c + 1);
      } else if (rating === "again") {
        setCombo(0);
      }
      // "hard" keeps combo unchanged

      // Mark as reviewed
      reviewedIds.current.add(card.id);

      // Submit to backend (fire-and-forget with offline fallback)
      try {
        const res = await learnerApiFetch(`/api/flashcards/reviews/${card.id}`, {
          body: JSON.stringify({ rating, userId }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (!res.ok) throw new Error("submit-fail");
      } catch {
        // Offline fallback
        try {
          await enqueueReview({ clientMutationId: `${card.id}-${Date.now()}`, rating, userId, userFlashcardId: card.id });
        } catch {
          /* best effort */
        }
      }

      // Move to next card or load more
      const nextIdx = currentIdx + 1;
      if (nextIdx >= cards.length) {
        // Try loading more
        try {
          const more = await fetchCards();
          const fresh = more.filter((c) => !reviewedIds.current.has(c.id));
          if (fresh.length > 0) {
            setCards(fresh);
            setCurrentIdx(0);
            const m = pickMode(0, fresh.length);
            setMode(m);
            setFlipped(false);
            setTypeRevealed(false);
            if (m === "match") setMatchOptions(generateOptions(fresh[0], fresh));
          } else {
            setPhase("summary");
          }
        } catch {
          setPhase("summary");
        }
      } else {
        setCurrentIdx(nextIdx);
        const m = pickMode(nextIdx, cards.length);
        setMode(m);
        setFlipped(false);
        setTypeRevealed(false);
        if (m === "match") setMatchOptions(generateOptions(cards[nextIdx], cards));
      }
    },
    [cards, currentIdx, userId, combo, fetchCards],
  );

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape") {
        onExit();
        return;
      }

      if (phase !== "review") return;

      const card = cards[currentIdx];
      if (!card) return;

      // Flip mode: Space to flip, then 1/2/3 to rate
      if (mode === "flip") {
        if (!flipped && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          setFlipped(true);
          return;
        }
        if (flipped) {
          if (e.key === "1") void submitRating("again");
          else if (e.key === "2") void submitRating("hard");
          else if (e.key === "3") void submitRating("good");
        }
      }

      // Type mode: after revealed, 1/2/3 to rate
      if (mode === "type" && typeRevealed) {
        if (e.key === "1") void submitRating("again");
        else if (e.key === "2") void submitRating("hard");
        else if (e.key === "3") void submitRating("good");
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, mode, flipped, typeRevealed, cards, currentIdx, submitRating, onExit]);

  /* ── Touch swipe (flip mode) ── */
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current || !flipped || mode !== "flip") return;
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const dy = e.changedTouches[0].clientY - touchStart.current.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        void submitRating(dx > 0 ? "good" : "again");
      }
      touchStart.current = null;
    },
    [flipped, mode, submitRating],
  );

  /* ── Review more (after summary) ── */
  const reviewMore = useCallback(async () => {
    setPhase("loading");
    try {
      const more = await fetchCards();
      const fresh = more.filter((c) => !reviewedIds.current.has(c.id));
      setCards(fresh);
      setTotalDue(fresh.length);
      if (fresh.length > 0) {
        startSession();
      } else {
        setPhase("entry");
      }
    } catch {
      setPhase("entry");
    }
  }, [fetchCards, startSession]);

  /* ── Render ── */
  const currentCard = cards[currentIdx] ?? null;
  const batchProgress = cards.length > 0 ? ((currentIdx + 1) / cards.length) * 100 : 0;
  const showRating =
    (mode === "flip" && flipped) || (mode === "type" && typeRevealed);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Loading */}
      {phase === "loading" ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-400/30 border-t-emerald-400" />
            <p className="text-sm font-semibold text-white/50">{labels.loadingCards}</p>
          </div>
        </div>
      ) : null}

      {/* Error */}
      {error && phase !== "loading" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-white/60">{error}</p>
          <button
            className="rounded-xl bg-white/10 px-6 py-2 text-sm font-bold text-white"
            onClick={() => {
              setError(null);
              setPhase("loading");
              void fetchCards()
                .then((loaded) => {
                  setCards(loaded);
                  setTotalDue(loaded.length);
                  setPhase("entry");
                })
                .catch(() => {
                  setError(labels.errorLoading);
                  setPhase("entry");
                });
            }}
            type="button"
          >
            {labels.retry}
          </button>
        </div>
      ) : null}

      {/* Entry */}
      {phase === "entry" && !error ? (
        <EntryScreen
          dueCount={totalDue}
          labels={labels}
          onStart={startSession}
          onExit={onExit}
        />
      ) : null}

      {/* Review */}
      {phase === "review" && currentCard ? (
        <>
          {/* Top bar */}
          <header className="flex items-center justify-between px-4 py-3 sm:px-6">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white"
              onClick={onExit}
              type="button"
              aria-label={labels.exitSession}
            >
              <svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <ProgressRing
                value={batchProgress}
                size={44}
                label={`${currentIdx + 1}${labels.sessionOf}${cards.length}`}
              />
            </div>

            <ComboDisplay combo={combo} />
          </header>

          {/* Card area */}
          <div className="flex flex-1 flex-col items-center justify-center px-4 pb-4" key={`${currentCard.id}-${mode}`}>
            {mode === "flip" ? (
              <FlipReview
                card={currentCard}
                labels={labels}
                flipped={flipped}
                onFlip={() => setFlipped(true)}
              />
            ) : mode === "type" ? (
              <TypeReview
                card={currentCard}
                labels={labels}
                revealed={typeRevealed}
                onReveal={() => setTypeRevealed(true)}
              />
            ) : mode === "match" ? (
              <MatchReview
                card={currentCard}
                options={matchOptions}
                labels={labels}
                onAnswer={(correct) => void submitRating(correct ? "good" : "again")}
              />
            ) : null}

            {/* Rating buttons (flip & type after reveal) */}
            {showRating ? <RatingButtons labels={labels} onRate={(r) => void submitRating(r)} /> : null}
          </div>

          {/* Bottom hint */}
          <footer className="pb-4 text-center sm:pb-6">
            <p className="text-xs text-white/25">{labels.keyboardHint}</p>
          </footer>
        </>
      ) : null}

      {/* Summary */}
      {phase === "summary" ? (
        <SummaryScreen
          stats={stats}
          labels={labels}
          onReviewMore={() => void reviewMore()}
          onExit={onExit}
        />
      ) : null}
    </div>
  );
}
