"use client";

import type { BattleBotAnimationState } from "@nihongo-bjt/shared";
import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BattleBotAvatar } from "../../../_components/battle-bot-avatar";

type StudyMode = "flip" | "shuffle" | "quiz";
type Rating = "again" | "hard" | "good";

export type DeckStudySessionLabels = {
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
  exampleCopied: string;
  exampleCopy: string;
  exampleEmpty: string;
  exampleFilterPlaceholder: string;
  exampleHeading: string;
  exampleManage: string;
  exampleSourceGrammar: string;
  exampleSourceKanji: string;
  exampleSourceLexeme: string;
  exampleToggleHide: string;
  exampleToggleShow: string;
  /* ── rating / mentor / streak labels ── */
  deckStudyRateAgain: string;
  deckStudyRateHard: string;
  deckStudyRateGood: string;
  deckStudyRateHint: string;
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
};

export type DeckStudyCard = {
  backText: string;
  examples?: DeckStudyExample[];
  frontText: string;
  id: string;
  reading: string | null;
};

export type DeckStudyExample = {
  id: string;
  japaneseText: string;
  reading: string | null;
  sourceKind: "grammar" | "kanji" | "lexeme";
  translationVi: string | null;
};

/**
 * In-deck browse study with multiple modes: flip, shuffle, quiz.
 * Completion screen when all cards viewed.
 */

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateQuizOptions(current: DeckStudyCard, all: DeckStudyCard[]): string[] {
  const correct = current.backText;
  const others = all
    .filter((c) => c.id !== current.id && c.backText !== correct)
    .map((c) => c.backText);
  const picks = shuffleArr(others).slice(0, 3);
  while (picks.length < 3) picks.push("—");
  return shuffleArr([correct, ...picks]);
}

export function DeckStudySession({
  cards,
  focusIndex,
  labels,
  onIndexChange,
}: {
  cards: DeckStudyCard[];
  focusIndex?: number | null;
  labels: DeckStudySessionLabels;
  onIndexChange?: (index: number) => void;
}) {
  const [mode, setMode] = useState<StudyMode>("flip");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [exampleFilter, setExampleFilter] = useState("");
  const [examplesOpen, setExamplesOpen] = useState(true);
  const [copiedExampleId, setCopiedExampleId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  // Quiz state
  const [quizSelected, setQuizSelected] = useState<string | null>(null);
  const [quizCorrectCount, setQuizCorrectCount] = useState(0);
  const [quizTotalCount, setQuizTotalCount] = useState(0);

  // Shuffled order (recomputed when mode changes)
  const [shuffledCards, setShuffledCards] = useState<DeckStudyCard[]>([]);

  // ── Card animation state ──
  const [cardAnim, setCardAnim] = useState<"enter" | "exit" | "idle">("idle");
  const prevCardId = useRef<string | null>(null);

  // ── Streak ──
  const { bump: bumpStreak, milestone, streak } = useStreak();

  // ── Mentor bubble ──
  const [mentorState, setMentorState] = useState<{ exiting: boolean; rating: Rating } | null>(null);
  const mentorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Ref for scroll into view ──
  const sectionRef = useRef<HTMLElement>(null);

  const activeCards = mode === "shuffle" || mode === "quiz" ? shuffledCards : cards;

  const total = activeCards.length;
  const safeIndex = total === 0 ? 0 : Math.min(Math.max(0, index), total - 1);
  const current = total === 0 ? undefined : activeCards[safeIndex];

  // Quiz options for current card
  const quizOptions = useMemo(() => {
    if (mode !== "quiz" || !current) return [];
    return generateQuizOptions(current, cards);
  }, [mode, current, cards]);

  // Switch mode handler
  const switchMode = useCallback((m: StudyMode) => {
    setMode(m);
    setIndex(0);
    setFlipped(false);
    setCompleted(false);
    setQuizSelected(null);
    setQuizCorrectCount(0);
    setQuizTotalCount(0);
    setCardAnim("enter");
    if (m === "shuffle" || m === "quiz") {
      setShuffledCards(shuffleArr(cards));
    }
  }, [cards]);

  // ── Handle focusIndex from parent (card list click) ──
  useEffect(() => {
    if (focusIndex != null && focusIndex >= 0 && focusIndex < cards.length && mode !== "quiz") {
      // Only in flip mode, go directly to index
      if (mode === "shuffle") {
        switchMode("flip");
      }
      setIndex(focusIndex);
      setFlipped(false);
      setCardAnim("enter");
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusIndex]);

  useEffect(() => {
    if (index !== safeIndex) {
      setIndex(safeIndex);
    }
  }, [index, safeIndex]);

  // Card enter animation on card change
  useEffect(() => {
    const cid = current?.id ?? null;
    if (cid && prevCardId.current && cid !== prevCardId.current) {
      setCardAnim("enter");
    }
    prevCardId.current = cid;
  }, [current?.id]);

  // Clear enter anim after it plays
  useEffect(() => {
    if (cardAnim === "enter") {
      const t = setTimeout(() => setCardAnim("idle"), 400);
      return () => clearTimeout(t);
    }
  }, [cardAnim]);

  // Clean up mentor timer
  useEffect(() => {
    return () => {
      if (mentorTimer.current) clearTimeout(mentorTimer.current);
    };
  }, []);

  useEffect(() => {
    setFlipped(false);
    setExampleFilter("");
    setCopiedExampleId(null);
    setQuizSelected(null);
    setMentorState(null);
  }, [safeIndex]);

  // Notify parent of index changes outside setState updater (avoids render-during-render)
  useEffect(() => {
    onIndexChange?.(safeIndex);
  }, [safeIndex, onIndexChange]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i <= 0 ? 0 : i - 1));
    setFlipped(false);
    setCardAnim("enter");
  }, []);

  const goNext = useCallback(() => {
    if (index >= total - 1) {
      setCompleted(true);
      return;
    }
    setCardAnim("exit");
    setTimeout(() => {
      setIndex((i) => i + 1);
      setFlipped(false);
      setCardAnim("enter");
    }, 300);
  }, [index, total]);

  const toggleFlip = useCallback(() => {
    if (total === 0) return;
    setFlipped((f) => !f);
  }, [total]);

  // ── Self-rating handler (flip/shuffle mode) ──
  const handleRate = useCallback((rating: Rating) => {
    bumpStreak(rating);

    // Show mentor bubble briefly
    setMentorState({ exiting: false, rating });
    if (mentorTimer.current) clearTimeout(mentorTimer.current);
    mentorTimer.current = setTimeout(() => {
      setMentorState((prev) => (prev ? { ...prev, exiting: true } : null));
      setTimeout(() => setMentorState(null), 280);
    }, 1600);

    // Exit animation then advance (or stay for "again")
    if (rating === "again") {
      // Stay on same card, just unflip
      setFlipped(false);
      return;
    }
    // "hard" or "good" → advance
    goNext();
  }, [bumpStreak, goNext]);

  // Quiz answer handler
  const handleQuizAnswer = useCallback((opt: string) => {
    if (quizSelected || !current) return;
    setQuizSelected(opt);
    const isCorrect = opt === current.backText;
    setQuizTotalCount((c) => c + 1);
    if (isCorrect) setQuizCorrectCount((c) => c + 1);
    // Auto-advance after delay
    setTimeout(() => {
      goNext();
    }, 1200);
  }, [quizSelected, current, goNext]);

  useEffect(() => {
    if (total === 0 || completed) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) {
        return;
      }
      if (mode === "quiz") return; // Quiz uses click only
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggleFlip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, toggleFlip, total, mode, completed]);

  if (cards.length === 0) {
    return null;
  }

  // Completion screen
  if (completed) {
    const quizAccuracy = quizTotalCount > 0 ? Math.round((quizCorrectCount / quizTotalCount) * 100) : 0;
    return (
      <section className="mb-8 rounded-3xl border border-ink/10 bg-gradient-to-b from-surface via-surface to-paper/70 p-5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.12)] ring-1 ring-ink/[0.04] sm:p-7">
        <div className="flex flex-col items-center gap-6 py-10 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 shadow-md">
            <span className="text-4xl" aria-hidden>🎉</span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-ink">{labels.deckStudyComplete}</h3>
            <p className="mt-2 text-sm text-muted">
              {labels.deckStudyCompleteDesc.replace("{total}", String(cards.length))}
            </p>
          </div>
          {mode === "quiz" && quizTotalCount > 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-ink/8 bg-surface px-5 py-3">
              <span className="text-sm font-semibold text-muted">{labels.deckStudyCompleteAccuracy}:</span>
              <span className={`text-2xl font-black tabular-nums ${quizAccuracy >= 70 ? "text-emerald-600" : "text-amber-500"}`}>
                {quizAccuracy}%
              </span>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              className="rounded-2xl bg-ink px-6 py-3 text-sm font-bold text-surface shadow-md transition hover:bg-ink/90"
              onClick={() => switchMode(mode)}
              type="button"
            >
              {labels.deckStudyRestart}
            </button>
            {mode !== "quiz" ? (
              <button
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-500/20"
                onClick={() => switchMode("quiz")}
                type="button"
              >
                {labels.deckStudyModeQuiz}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (total === 0 || !current) {
    return null;
  }

  const displayIndex = safeIndex + 1;
  const progressLabel = labels.deckStudyProgressTpl
    .replace("{current}", String(displayIndex))
    .replace("{total}", String(total));
  const progressPct = total > 0 ? (displayIndex / total) * 100 : 0;
  const atStart = safeIndex <= 0;
  const atEnd = safeIndex >= total - 1;
  const examples = current.examples ?? [];
  const normalizedFilter = exampleFilter.trim().toLowerCase();
  const filteredExamples = normalizedFilter
    ? examples.filter((example) => {
        const haystack = `${example.japaneseText} ${example.reading ?? ""} ${example.translationVi ?? ""}`.toLowerCase();
        return haystack.includes(normalizedFilter);
      })
    : examples;

  const flipAriaLabel = flipped
    ? `${labels.deckStudyFaceBack}. ${labels.deckStudyTapToFlip}`
    : `${labels.deckStudyFaceFront}. ${labels.deckStudyTapToFlip}`;

  const modeButtons: { id: StudyMode; label: string; icon: string }[] = [
    { id: "flip", label: labels.deckStudyModeFlip, icon: "🔄" },
    { id: "shuffle", label: labels.deckStudyModeShuffle, icon: "🔀" },
    { id: "quiz", label: labels.deckStudyModeQuiz, icon: "❓" },
  ];

  return (
    <section
      ref={sectionRef}
      aria-labelledby="deck-study-eyebrow"
      className="mb-8 rounded-3xl border border-ink/10 bg-gradient-to-b from-surface via-surface to-paper/70 p-5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.12)] ring-1 ring-ink/[0.04] sm:p-7"
    >
      {/* Header with mode selector + progress ring + streak */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent" id="deck-study-eyebrow">
            {labels.deckStudyEyebrow}
          </p>
          {/* Mode selector pills */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {modeButtons.map((m) => (
              <button
                key={m.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition",
                  mode === m.id
                    ? "bg-ink text-surface shadow-sm"
                    : "border border-ink/10 bg-paper text-muted hover:bg-white hover:text-ink"
                )}
                onClick={() => switchMode(m.id)}
                type="button"
              >
                <span aria-hidden>{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {mode !== "quiz" && streak >= 2 ? (
            <StreakBadge label={labels.streakLabel} streak={streak} />
          ) : null}
          <ProgressRing reviewed={displayIndex} total={total} />
          <p
            className="shrink-0 rounded-full border border-ink/10 bg-paper/90 px-3 py-1.5 text-xs font-black tabular-nums tracking-tight text-ink shadow-sm sm:text-sm"
            role="status"
          >
            {progressLabel}
          </p>
        </div>
      </div>

      <div
        aria-valuemax={total}
        aria-valuemin={1}
        aria-valuenow={displayIndex}
        className="mb-6 h-2 overflow-hidden rounded-full bg-ink/[0.08] ring-1 ring-inset ring-ink/[0.06]"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent via-accent to-leaf motion-reduce:transition-none motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="mx-auto max-w-xl">
        {mode === "quiz" ? (
          /* ── Quiz mode: show front + 4 options ── */
          <div
            className={cn(
              "fc-card-shell rounded-[1.75rem] p-6 text-center sm:p-8",
              cardAnim === "enter" && "fc-card-enter",
              cardAnim === "exit" && "fc-card-exit"
            )}
            key={current.id}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted/70">
              {labels.deckStudyQuizPrompt}
            </p>
            <p className="jp-text mt-5 text-4xl font-black leading-[1.3] tracking-tight text-ink sm:text-5xl" lang="ja">
              {current.frontText}
            </p>
            {current.reading ? (
              <p className="jp-text mt-3 text-base font-medium text-muted/80 sm:text-lg" lang="ja">
                {current.reading}
              </p>
            ) : null}
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {quizOptions.map((opt) => {
                const correct = current.backText;
                let cls = "border-ink/10 bg-white shadow-sm hover:bg-paper hover:border-ink/20 hover:shadow-md";
                if (quizSelected) {
                  if (opt === correct) cls = "border-emerald-400/60 bg-emerald-50 shadow-emerald-100/50 shadow-md ring-1 ring-emerald-400/30";
                  else if (opt === quizSelected) cls = "border-red-400/60 bg-red-50 shadow-red-100/50 shadow-md ring-1 ring-red-400/30";
                  else cls = "border-ink/6 bg-paper/40 opacity-40";
                }
                return (
                  <button
                    key={opt}
                    className={`rounded-2xl border-2 px-5 py-4 text-base font-semibold text-ink transition-all duration-200 ${cls}`}
                    onClick={() => handleQuizAnswer(opt)}
                    disabled={quizSelected !== null}
                    type="button"
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {quizSelected ? (
              <p className={`mt-3 text-sm font-bold ${quizSelected === current.backText ? "text-emerald-600" : "text-red-500"}`}>
                {quizSelected === current.backText ? labels.deckStudyQuizCorrect : `${labels.deckStudyQuizWrong} — ${labels.deckStudyQuizAnswer}: ${current.backText}`}
              </p>
            ) : null}
          </div>
        ) : (
          /* ── Flip/Shuffle mode: 3D card with animations ── */
          <div
            className={cn(
              cardAnim === "enter" && "fc-card-enter",
              cardAnim === "exit" && "fc-card-exit"
            )}
          >
            <div className={cn("relative [perspective:1400px]", flipped && "fc-card-reveal")}>
              <button
                aria-label={flipAriaLabel}
                className={cn(
                  "fc-card-shell relative min-h-[20rem] w-full rounded-[1.75rem] p-1.5 text-left outline-none ring-offset-2 transition-[box-shadow,transform] duration-300 hover:shadow-[0_20px_60px_-12px_rgba(0,0,0,0.18)] active:scale-[0.985] motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-accent sm:min-h-[22rem] sm:p-2",
                  "[transform-style:preserve-3d]"
                )}
                onClick={toggleFlip}
                type="button"
              >
                <div
                  className={cn(
                    "relative min-h-[17.5rem] w-full motion-reduce:transition-none motion-safe:transition-transform motion-safe:duration-600 motion-safe:[transition-timing-function:cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] sm:min-h-[19rem]",
                    flipped && "motion-safe:[transform:rotateY(180deg)]"
                  )}
                >
                  {/* ── Front face ── */}
                  <div className="absolute inset-0 flex flex-col justify-between rounded-[1.25rem] border border-ink/[0.06] bg-gradient-to-br from-white via-paper to-blue-50/40 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backface-hidden sm:p-8">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-accent">
                          {labels.deckStudyFaceFront}
                        </span>
                      </div>
                      <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-muted/70">
                        {labels.deckStudyFlipPrompt}
                      </p>
                      <p className="jp-text mt-3 text-4xl font-black leading-[1.3] tracking-tight text-ink sm:text-5xl" lang="ja">
                        {current.frontText}
                      </p>
                      {current.reading ? (
                        <p className="jp-text mt-3 text-base font-medium text-muted/80 sm:text-lg" lang="ja">
                          {current.reading}
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-2 border-t border-ink/[0.06] pt-3">
                      <span className="text-xs text-muted/50">↻</span>
                      <p className="text-[11px] font-semibold text-muted/60">
                        {labels.deckStudyTapToFlip}
                      </p>
                    </div>
                  </div>
                  {/* ── Back face ── */}
                  <div className="absolute inset-0 flex flex-col justify-between rounded-[1.25rem] border border-leaf/20 bg-gradient-to-br from-emerald-50 via-leaf-soft/60 to-white p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] [transform:rotateY(180deg)] backface-hidden sm:p-8">
                    <div>
                      <span className="inline-flex rounded-full border border-leaf/30 bg-leaf/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-leaf">
                        {labels.deckStudyFaceBack}
                      </span>
                      {/* Answer with slide-in animation */}
                      <div className={flipped ? "fc-answer-enter" : ""}>
                        <p className="mt-5 text-xl font-bold leading-relaxed text-ink sm:text-2xl">{current.backText}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-2 border-t border-leaf/15 pt-3">
                      <span className="text-xs text-muted/50">↻</span>
                      <p className="text-[11px] font-semibold text-muted/60">
                        {labels.deckStudyTapToFlip}
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* ── Shiba companion ── */}
            {mentorState ? (
              <ShibaCompanion
                exiting={mentorState.exiting}
                labels={labels}
                milestone={milestone}
                rating={mentorState.rating}
              />
            ) : null}

            {/* ── Rating buttons (appear after flip) ── */}
            {flipped ? (
              <div className="fc-btn-stagger mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  className="fc-btn-press inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl border-2 border-sakura/25 bg-gradient-to-b from-sakura/10 to-sakura/5 px-5 text-sm font-bold text-sakura shadow-sm outline-none ring-offset-2 transition-all hover:border-sakura/40 hover:from-sakura/15 hover:shadow-md focus-visible:ring-2 focus-visible:ring-sakura/50"
                  onClick={() => handleRate("again")}
                  type="button"
                >
                  <span className="text-base">🌱</span> {labels.deckStudyRateAgain}
                </button>
                <button
                  className="fc-btn-press inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl border-2 border-sun/25 bg-gradient-to-b from-sun/10 to-sun/5 px-5 text-sm font-bold text-amber-700 shadow-sm outline-none ring-offset-2 transition-all hover:border-sun/40 hover:from-sun/15 hover:shadow-md focus-visible:ring-2 focus-visible:ring-sun/50"
                  onClick={() => handleRate("hard")}
                  type="button"
                >
                  <span className="text-base">💪</span> {labels.deckStudyRateHard}
                </button>
                <button
                  className="fc-btn-press inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl border-2 border-leaf/30 bg-gradient-to-b from-leaf to-emerald-600 px-6 text-sm font-bold text-white shadow-md shadow-leaf/20 outline-none ring-offset-2 transition-all hover:from-leaf/90 hover:shadow-lg hover:shadow-leaf/25 focus-visible:ring-2 focus-visible:ring-leaf/50"
                  onClick={() => handleRate("good")}
                  type="button"
                >
                  <span className="text-base">🎉</span> {labels.deckStudyRateGood}
                </button>
              </div>
            ) : null}
            {flipped ? (
              <p className="mt-2 text-center text-[10px] font-semibold text-muted/70">
                {labels.deckStudyRateHint}
              </p>
            ) : null}

            {/* ── Prev/Next buttons ── */}
            <div className="mt-5 flex flex-wrap items-stretch justify-between gap-3 sm:gap-4">
              <button
                className="inline-flex min-h-[3rem] min-w-[7.5rem] flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-ink/10 bg-white px-5 text-sm font-black text-ink shadow-sm outline-none ring-offset-2 transition-all hover:border-ink/20 hover:bg-paper hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-30 sm:flex-none"
                disabled={atStart}
                onClick={goPrev}
                type="button"
              >
                <span aria-hidden className="text-xs">←</span> {labels.deckStudyPrev}
              </button>
              <button
                className="inline-flex min-h-[3rem] min-w-[7.5rem] flex-1 items-center justify-center gap-1.5 rounded-2xl bg-ink px-5 text-sm font-black text-surface shadow-lg shadow-ink/20 outline-none ring-offset-2 transition-all hover:bg-ink/90 hover:shadow-xl hover:shadow-ink/25 active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-30 sm:flex-none"
                onClick={goNext}
                type="button"
              >
                {labels.deckStudyNext} <span aria-hidden className="text-xs">→</span>
              </button>
            </div>
          </div>
        )}

        <p className="mt-4 text-center text-[10px] font-semibold uppercase tracking-wide text-muted/90">
          {labels.deckStudyKeyboardHint}
        </p>
      </div>

      <section className="mt-6 overflow-hidden rounded-3xl border border-ink/10 bg-surface shadow-sm">
        <div className="flex flex-col gap-3 border-b border-ink/8 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">
              {labels.exampleManage}
            </p>
            <h3 className="mt-1 text-base font-bold text-ink">
              {labels.exampleHeading}
              <span className="ml-2 rounded-full bg-paper px-2 py-0.5 text-xs font-black tabular-nums text-muted">
                {examples.length}
              </span>
            </h3>
          </div>
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-ink/12 bg-paper px-3 text-xs font-black text-ink outline-none ring-offset-2 transition hover:bg-white focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => setExamplesOpen((value) => !value)}
            type="button"
          >
            {examplesOpen ? labels.exampleToggleHide : labels.exampleToggleShow}
          </button>
        </div>

        {examplesOpen ? (
          <div className="space-y-4 p-4 sm:p-5">
            {examples.length > 0 ? (
              <label className="block">
                <span className="sr-only">{labels.exampleFilterPlaceholder}</span>
                <input
                  className="min-h-11 w-full rounded-2xl border border-ink/12 bg-paper px-4 text-sm font-semibold text-ink outline-none ring-offset-2 placeholder:text-muted/70 focus:border-accent focus:bg-white focus-visible:ring-2 focus-visible:ring-accent"
                  onChange={(event) => setExampleFilter(event.target.value)}
                  placeholder={labels.exampleFilterPlaceholder}
                  type="search"
                  value={exampleFilter}
                />
              </label>
            ) : null}

            {filteredExamples.length > 0 ? (
              <ul className="grid gap-3">
                {filteredExamples.map((example) => (
                  <li
                    className="rounded-2xl border border-ink/10 bg-paper/70 p-4 shadow-sm"
                    key={example.id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <span className="inline-flex rounded-full border border-accent/20 bg-accent-soft/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-accent">
                          {sourceLabel(example.sourceKind, labels)}
                        </span>
                        <p className="jp-text mt-2 text-base font-bold leading-relaxed text-ink" lang="ja">
                          {example.japaneseText}
                        </p>
                        {example.reading ? (
                          <p className="jp-text mt-1 text-sm leading-relaxed text-muted" lang="ja">
                            {example.reading}
                          </p>
                        ) : null}
                        {example.translationVi ? (
                          <p className="mt-2 text-sm leading-relaxed text-ink/80">
                            {example.translationVi}
                          </p>
                        ) : null}
                      </div>
                      <button
                        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-ink/12 bg-surface px-3 text-xs font-black text-ink outline-none ring-offset-2 transition hover:bg-white focus-visible:ring-2 focus-visible:ring-accent"
                        onClick={() => void copyExample(example)}
                        type="button"
                      >
                        {copiedExampleId === example.id ? labels.exampleCopied : labels.exampleCopy}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-ink/12 bg-paper/60 px-4 py-6 text-center text-sm font-semibold leading-relaxed text-muted">
                {labels.exampleEmpty}
              </p>
            )}
          </div>
        ) : null}
      </section>
    </section>
  );

  async function copyExample(example: DeckStudyExample) {
    const text = [example.japaneseText, example.reading, example.translationVi].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedExampleId(example.id);
      window.setTimeout(() => setCopiedExampleId(null), 1600);
    } catch {
      setCopiedExampleId(null);
    }
  }
}

function sourceLabel(kind: DeckStudyExample["sourceKind"], labels: DeckStudySessionLabels) {
  if (kind === "grammar") return labels.exampleSourceGrammar;
  if (kind === "kanji") return labels.exampleSourceKanji;
  return labels.exampleSourceLexeme;
}

/* ─── Streak hook ─── */

function useStreak() {
  const [streak, setStreak] = useState(0);
  const [milestone, setMilestone] = useState<number | null>(null);
  const milestoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bump = useCallback((rating: Rating) => {
    if (rating === "again") {
      setStreak(0);
      return;
    }
    setStreak((prev) => {
      const next = prev + 1;
      if (next === 5 || next === 10 || next === 25) {
        setMilestone(next);
        if (milestoneTimer.current) clearTimeout(milestoneTimer.current);
        milestoneTimer.current = setTimeout(() => {
          setMilestone(null);
          milestoneTimer.current = null;
        }, 2200);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (milestoneTimer.current) clearTimeout(milestoneTimer.current);
    };
  }, []);

  return { bump, milestone, streak };
}

/* ─── Streak Badge ─── */

function StreakBadge({ label, streak }: { label: string; streak: number }) {
  if (streak < 2) return null;
  return (
    <span
      className={cn(
        "fc-streak-pop inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums shadow-sm ring-1",
        streak >= 10
          ? "bg-gradient-to-r from-leaf/90 to-leaf text-white ring-leaf/30"
          : streak >= 5
            ? "bg-leaf-soft/70 text-leaf ring-leaf/25"
            : "bg-paper text-muted ring-ink/10"
      )}
      key={streak}
    >
      <span aria-hidden>{streak >= 10 ? "🔥" : streak >= 5 ? "⚡" : "✦"}</span>
      {label}: {streak}
    </span>
  );
}

/* ─── Progress Ring ─── */

function ProgressRing({
  reviewed,
  total,
  size = 40,
  strokeWidth = 3,
}: {
  reviewed: number;
  size?: number;
  strokeWidth?: number;
  total: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.min(reviewed / total, 1) : 0;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          className="fc-progress-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="fc-progress-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          style={{
            "--fc-ring-circumference": circumference,
            "--fc-ring-offset": offset,
          } as React.CSSProperties}
        />
      </svg>
      <span className="absolute text-[9px] font-bold tabular-nums text-ink">
        {reviewed}
      </span>
    </div>
  );
}

/* ─── Mentor Bubble ─── */

type ShibaCompanionLabels = Pick<
  DeckStudySessionLabels,
  | "mentorName"
  | "mentorGoodText"
  | "mentorHardText"
  | "mentorAgainText"
  | "mentorMilestone5"
  | "mentorMilestone10"
  | "mentorMilestone25"
>;

/* ─── Rive companion asset (same as global companion bot) ─── */

const companionRive = {
  artboard: null,
  src: "/assets/battle/bots/18912-35694-lil-guy.riv",
  stateMachine: null,
};

const ratingToRiveState: Record<Rating, BattleBotAnimationState> = {
  good: "correct",
  hard: "thinking",
  again: "wrong",
};

/* ─── Shiba Companion (Rive-animated) ─── */

function ShibaCompanion({
  exiting,
  labels,
  milestone,
  rating,
}: {
  exiting: boolean;
  labels: ShibaCompanionLabels;
  milestone: number | null;
  rating: Rating;
}) {
  const text =
    rating === "good"
      ? labels.mentorGoodText
      : rating === "hard"
        ? labels.mentorHardText
        : labels.mentorAgainText;

  const milestoneText =
    milestone === 5
      ? labels.mentorMilestone5
      : milestone === 10
        ? labels.mentorMilestone10
        : milestone === 25
          ? labels.mentorMilestone25
          : null;

  const bubbleBg =
    rating === "good"
      ? "bg-gradient-to-br from-white to-emerald-50 ring-leaf/20"
      : rating === "hard"
        ? "bg-gradient-to-br from-white to-amber-50 ring-sun/20"
        : "bg-gradient-to-br from-white to-pink-50 ring-sakura/20";

  return (
    <div
      className={cn(
        "mt-4 flex items-end gap-3",
        exiting ? "fc-shiba-exit" : "fc-shiba-enter"
      )}
      role="status"
      aria-live="polite"
    >
      {/* Rive companion avatar */}
      <div className="fc-shiba-bob h-14 w-14 shrink-0 drop-shadow-md sm:h-16 sm:w-16">
        <BattleBotAvatar
          fallback="🐕"
          rive={companionRive}
          showSignal={false}
          state={ratingToRiveState[rating]}
          variant="companion"
        />
      </div>
      {/* Speech bubble */}
      <div className={cn("fc-shiba-bubble relative min-w-0 flex-1 rounded-2xl px-4 py-3 shadow-md ring-1", bubbleBg)}>
        <div className="absolute -left-1.5 bottom-3 h-3 w-3 rotate-45 bg-white" />
        <p className="relative text-sm font-semibold leading-relaxed text-ink">{text}</p>
        {milestoneText && milestone ? (
          <div className="fc-milestone-burst relative mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1 text-xs font-bold text-leaf shadow-sm ring-1 ring-leaf/20">
            <span className="fc-confetti">
              🔥
              <span className="fc-confetti-extra" aria-hidden />
            </span>
            {milestoneText.replace("{n}", String(milestone))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
