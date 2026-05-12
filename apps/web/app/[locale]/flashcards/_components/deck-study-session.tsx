"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

type StudyMode = "flip" | "shuffle" | "quiz";

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

export function DeckStudySession({ cards, labels }: { cards: DeckStudyCard[]; labels: DeckStudySessionLabels }) {
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
    if (m === "shuffle" || m === "quiz") {
      setShuffledCards(shuffleArr(cards));
    }
  }, [cards]);

  useEffect(() => {
    if (index !== safeIndex) {
      setIndex(safeIndex);
    }
  }, [index, safeIndex]);

  useEffect(() => {
    setFlipped(false);
    setExampleFilter("");
    setCopiedExampleId(null);
    setQuizSelected(null);
  }, [safeIndex]);

  const goPrev = useCallback(() => {
    setIndex((i) => {
      if (i <= 0) return 0;
      return i - 1;
    });
    setFlipped(false);
  }, []);

  const goNext = useCallback(() => {
    if (index >= total - 1) {
      setCompleted(true);
      return;
    }
    setIndex((i) => i + 1);
    setFlipped(false);
  }, [index, total]);

  const toggleFlip = useCallback(() => {
    if (total === 0) return;
    setFlipped((f) => !f);
  }, [total]);

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
      aria-labelledby="deck-study-eyebrow"
      className="mb-8 rounded-3xl border border-ink/10 bg-gradient-to-b from-surface via-surface to-paper/70 p-5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.12)] ring-1 ring-ink/[0.04] sm:p-7"
    >
      {/* Header with mode selector */}
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
        <p
          className="shrink-0 rounded-full border border-ink/10 bg-paper/90 px-3 py-1.5 text-xs font-black tabular-nums tracking-tight text-ink shadow-sm sm:text-sm"
          role="status"
        >
          {progressLabel}
        </p>
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
          <div className="rounded-3xl border border-ink/10 bg-paper/50 p-6 text-center shadow-inner sm:p-8" key={current.id}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted/80">
              {labels.deckStudyQuizPrompt}
            </p>
            <p className="jp-text mt-4 text-3xl font-black leading-snug tracking-tight text-ink sm:text-4xl" lang="ja">
              {current.frontText}
            </p>
            {current.reading ? (
              <p className="jp-text mt-2 text-base font-medium text-muted" lang="ja">
                {current.reading}
              </p>
            ) : null}
            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {quizOptions.map((opt) => {
                const correct = current.backText;
                let cls = "border-ink/12 bg-surface hover:bg-paper hover:border-ink/20";
                if (quizSelected) {
                  if (opt === correct) cls = "border-emerald-400/50 bg-emerald-50";
                  else if (opt === quizSelected) cls = "border-red-400/50 bg-red-50";
                  else cls = "border-ink/8 bg-paper/50 opacity-50";
                }
                return (
                  <button
                    key={opt}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold text-ink transition ${cls}`}
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
          /* ── Flip/Shuffle mode: 3D card ── */
          <>
            <div className="relative [perspective:1400px]">
              <button
                aria-label={flipAriaLabel}
                className={cn(
                  "relative min-h-[17rem] w-full rounded-3xl border border-ink/10 bg-paper/50 p-1 text-left shadow-inner outline-none ring-offset-2 transition-[box-shadow,transform] duration-200 hover:shadow-md active:scale-[0.99] motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-accent sm:min-h-[19rem] sm:p-1.5",
                  "[transform-style:preserve-3d]"
                )}
                onClick={toggleFlip}
                type="button"
              >
                <div
                  className={cn(
                    "relative min-h-[15.5rem] w-full motion-reduce:transition-none motion-safe:transition-transform motion-safe:duration-500 motion-safe:[transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-safe:ease-out [transform-style:preserve-3d] sm:min-h-[17rem]",
                    flipped && "motion-safe:[transform:rotateY(180deg)]"
                  )}
                >
                  <div className="absolute inset-0 flex flex-col justify-between rounded-[1.35rem] border border-ink/8 bg-gradient-to-br from-paper via-paper to-paper/95 p-5 shadow-sm backface-hidden sm:p-7">
                    <div>
                      <span className="inline-flex rounded-full border border-accent/25 bg-accent-soft/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-accent">
                        {labels.deckStudyFaceFront}
                      </span>
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted/90">
                        {labels.deckStudyFlipPrompt}
                      </p>
                      <p className="jp-text mt-2 text-2xl font-black leading-snug tracking-tight text-ink sm:text-3xl" lang="ja">
                        {current.frontText}
                      </p>
                      {current.reading ? (
                        <p className="jp-text mt-3 text-sm font-medium text-muted sm:text-base" lang="ja">
                          {current.reading}
                        </p>
                      ) : null}
                    </div>
                    <p className="mt-4 border-t border-ink/8 pt-3 text-center text-[11px] font-semibold text-muted">
                      {labels.deckStudyTapToFlip}
                    </p>
                  </div>
                  <div className="absolute inset-0 flex flex-col justify-between rounded-[1.35rem] border border-leaf/25 bg-gradient-to-br from-leaf-soft/80 via-leaf-soft/50 to-paper/90 p-5 shadow-sm [transform:rotateY(180deg)] backface-hidden sm:p-7">
                    <div>
                      <span className="inline-flex rounded-full border border-leaf/35 bg-leaf/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-leaf">
                        {labels.deckStudyFaceBack}
                      </span>
                      <p className="mt-4 text-base font-semibold leading-relaxed text-ink sm:text-lg">{current.backText}</p>
                    </div>
                    <p className="mt-4 border-t border-leaf/20 pt-3 text-center text-[11px] font-semibold text-muted">
                      {labels.deckStudyTapToFlip}
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-stretch justify-between gap-3 sm:gap-4">
              <button
                className="inline-flex min-h-12 min-w-[7rem] flex-1 items-center justify-center rounded-2xl border border-ink/12 bg-paper px-4 text-sm font-black text-ink shadow-sm outline-none ring-offset-2 transition-colors hover:bg-white hover:shadow focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-35 sm:flex-none"
                disabled={atStart}
                onClick={goPrev}
                type="button"
              >
                {labels.deckStudyPrev}
              </button>
              <button
                className="inline-flex min-h-12 min-w-[7rem] flex-1 items-center justify-center rounded-2xl bg-ink px-4 text-sm font-black text-surface shadow-md outline-none ring-offset-2 transition-[background-color,transform] hover:bg-ink/92 active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-35 sm:flex-none"
                onClick={goNext}
                type="button"
              >
                {labels.deckStudyNext}
              </button>
            </div>
          </>
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
