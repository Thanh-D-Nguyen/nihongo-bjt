"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

export type DeckStudySessionLabels = {
  deckStudyEyebrow: string;
  deckStudyFaceBack: string;
  deckStudyFaceFront: string;
  deckStudyFlipPrompt: string;
  deckStudyKeyboardHint: string;
  deckStudyModeNote: string;
  deckStudyNext: string;
  deckStudyPrev: string;
  deckStudyProgressTpl: string;
  deckStudyTapToFlip: string;
};

export type DeckStudyCard = {
  backText: string;
  frontText: string;
  id: string;
  reading: string | null;
};

/**
 * In-deck browse study: flip + order navigation only (does not post SRS reviews).
 */
export function DeckStudySession({ cards, labels }: { cards: DeckStudyCard[]; labels: DeckStudySessionLabels }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const total = cards.length;
  const safeIndex = total === 0 ? 0 : Math.min(Math.max(0, index), total - 1);
  const current = total === 0 ? undefined : cards[safeIndex];

  useEffect(() => {
    if (index !== safeIndex) {
      setIndex(safeIndex);
    }
  }, [index, safeIndex]);

  useEffect(() => {
    setFlipped(false);
  }, [safeIndex]);

  const goPrev = useCallback(() => {
    setIndex((i) => {
      if (i <= 0) return 0;
      return i - 1;
    });
    setFlipped(false);
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i >= total - 1) return total - 1;
      return i + 1;
    });
    setFlipped(false);
  }, [total]);

  const toggleFlip = useCallback(() => {
    if (total === 0) return;
    setFlipped((f) => !f);
  }, [total]);

  useEffect(() => {
    if (total === 0) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) {
        return;
      }
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
  }, [goNext, goPrev, toggleFlip, total]);

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

  const flipAriaLabel = flipped
    ? `${labels.deckStudyFaceBack}. ${labels.deckStudyTapToFlip}`
    : `${labels.deckStudyFaceFront}. ${labels.deckStudyTapToFlip}`;

  return (
    <section
      aria-labelledby="deck-study-eyebrow"
      className="mb-8 rounded-3xl border border-ink/10 bg-gradient-to-b from-surface via-surface to-paper/70 p-5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.12)] ring-1 ring-ink/[0.04] sm:p-7"
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent" id="deck-study-eyebrow">
            {labels.deckStudyEyebrow}
          </p>
          <p className="mt-1.5 max-w-prose text-xs font-semibold leading-relaxed text-muted sm:text-[13px]">
            {labels.deckStudyModeNote}
          </p>
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
            disabled={atEnd}
            onClick={goNext}
            type="button"
          >
            {labels.deckStudyNext}
          </button>
        </div>

        <p className="mt-4 text-center text-[10px] font-semibold uppercase tracking-wide text-muted/90">
          {labels.deckStudyKeyboardHint}
        </p>
      </div>
    </section>
  );
}
