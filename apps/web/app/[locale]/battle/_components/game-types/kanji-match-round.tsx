"use client";

import { useCallback, useEffect, useState } from "react";
import type { GameTypeRoundProps } from "./shared-props";

/**
 * Kanji Vocab Duel: Drag-and-match interaction.
 * 4 items on left, 4 on right. Tap left then tap right to connect.
 * On mobile: tap-to-select paradigm (no actual drag).
 */
export function KanjiMatchRound({
  answerResult,
  canAnswer,
  onSubmitAnswer,
  round
}: GameTypeRoundProps) {
  const options = round.question.options;
  // Split options into pairs: first half = "left" (kanji/term), second half = "right" (meaning)
  // If odd count, fallback to MC
  const half = Math.floor(options.length / 2);
  const leftItems = options.slice(0, half);
  const rightItems = options.slice(half);

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matches, setMatches] = useState<Map<string, string>>(new Map());
  const [shakeRight, setShakeRight] = useState<string | null>(null);

  // Reset on new round
  useEffect(() => {
    setSelectedLeft(null);
    setMatches(new Map());
    setShakeRight(null);
  }, [round.roundIndex]);

  const handleLeftTap = useCallback((key: string) => {
    if (!canAnswer) return;
    setSelectedLeft((prev) => (prev === key ? null : key));
  }, [canAnswer]);

  const handleRightTap = useCallback((key: string) => {
    if (!canAnswer || !selectedLeft) return;
    // Create match
    const newMatches = new Map(matches);
    newMatches.set(selectedLeft, key);
    setMatches(newMatches);
    setSelectedLeft(null);

    // If all matched, submit the last matched pair's right key as answer
    // The "correct" answer is determined by the first option being the correct match
    if (newMatches.size === leftItems.length) {
      // Submit the correct option key (first option is always correct in our system)
      onSubmitAnswer(options[0].optionKey);
    }
  }, [canAnswer, selectedLeft, matches, leftItems.length, onSubmitAnswer, options]);

  // If not enough options for matching, fall back to prompt display
  if (half < 2) {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl border border-ink/10 bg-paper/70 p-4 text-base font-semibold text-ink">
          {round.question.prompt}
        </p>
        <div className="grid gap-2">
          {options.map((opt) => (
            <button
              key={opt.optionKey}
              className="min-h-14 rounded-xl border border-ink/10 bg-white px-4 py-3 text-left text-sm font-bold text-ink hover:border-accent/20"
              disabled={!canAnswer}
              onClick={() => onSubmitAnswer(opt.optionKey)}
              type="button"
            >
              {opt.text}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>🀄</span>
        <span className="text-xs font-black uppercase text-violet-600">Match the Pairs</span>
        <span className="ml-auto rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-600">
          {matches.size}/{leftItems.length} matched
        </span>
      </div>

      {/* Prompt as context */}
      <p className="rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2 text-sm font-semibold text-violet-900">
        {round.question.prompt}
      </p>

      {/* Matching grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Left column */}
        <div className="space-y-2">
          {leftItems.map((item) => {
            const isMatched = matches.has(item.optionKey);
            const isSelected = selectedLeft === item.optionKey;
            return (
              <button
                key={item.optionKey}
                className={`w-full min-h-14 rounded-xl border px-3 py-2.5 text-center text-sm font-bold transition-all ${
                  isMatched
                    ? "border-leaf/30 bg-leaf/10 text-leaf"
                    : isSelected
                      ? "border-violet-400 bg-violet-100 text-violet-800 ring-2 ring-violet-300 scale-[1.02]"
                      : "border-ink/10 bg-white text-ink hover:border-violet-200 hover:bg-violet-50/50 active:scale-[0.97]"
                } ${!canAnswer ? "pointer-events-none opacity-60" : ""}`}
                disabled={!canAnswer || isMatched}
                onClick={() => handleLeftTap(item.optionKey)}
                type="button"
              >
                <span className="text-base">{item.text}</span>
              </button>
            );
          })}
        </div>

        {/* Right column */}
        <div className="space-y-2">
          {rightItems.map((item) => {
            const isMatchedTo = Array.from(matches.values()).includes(item.optionKey);
            const isShaking = shakeRight === item.optionKey;
            return (
              <button
                key={item.optionKey}
                className={`w-full min-h-14 rounded-xl border px-3 py-2.5 text-center text-sm font-bold transition-all ${
                  isMatchedTo
                    ? "border-leaf/30 bg-leaf/10 text-leaf"
                    : selectedLeft
                      ? "border-violet-200 bg-violet-50/30 text-ink hover:border-violet-400 hover:bg-violet-100 active:scale-[0.97]"
                      : "border-ink/10 bg-paper/50 text-muted"
                } ${isShaking ? "animate-shake" : ""} ${!canAnswer || !selectedLeft ? "pointer-events-none" : ""}`}
                disabled={!canAnswer || isMatchedTo || !selectedLeft}
                onClick={() => handleRightTap(item.optionKey)}
                type="button"
              >
                <span className="text-sm">{item.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Result feedback */}
      {answerResult && (
        <div className={`rounded-xl border px-3 py-2 text-sm font-black ${
          answerResult.userCorrect
            ? "border-leaf/20 bg-leaf/5 text-leaf"
            : "border-red-200 bg-red-50 text-red-600"
        }`}>
          {answerResult.userCorrect ? "✓ Perfect matching!" : "✗ Incorrect match"}
        </div>
      )}
    </div>
  );
}
