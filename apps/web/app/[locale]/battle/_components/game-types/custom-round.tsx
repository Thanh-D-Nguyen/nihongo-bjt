"use client";

import type { GameTypeRoundProps } from "./shared-props";

/**
 * Custom: Config-driven MC with visible active rules.
 * Shows which special rules are active (speed bonus, penalty, combo, etc.)
 */
export function CustomRound({
  answerPending,
  answerResult,
  canAnswer,
  onSubmitAnswer,
  round,
  selectedOptionKey
}: GameTypeRoundProps) {
  return (
    <div className="space-y-4">
      {/* Custom header */}
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden>⚙️</span>
        <span className="text-xs font-black uppercase text-muted">Custom Battle</span>
      </div>

      {/* Question */}
      <p className="rounded-2xl border border-ink/10 bg-paper/70 p-4 text-base font-semibold leading-7 text-ink sm:text-lg">
        {round.question.prompt}
      </p>

      {/* Options */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {round.question.options.map((option) => {
          const picked = selectedOptionKey === option.optionKey;
          const correct = answerResult?.correctOptionKey === option.optionKey;
          const wrong = picked && answerResult && !answerResult.userCorrect;
          return (
            <button
              key={option.optionKey}
              className={`min-h-14 rounded-xl border px-4 py-3 text-left text-sm font-bold leading-5 transition-all ${
                correct
                  ? "border-leaf/30 bg-leaf/10 text-leaf ring-2 ring-leaf/20"
                  : wrong
                    ? "border-sakura/30 bg-sakura-soft text-sakura-strong ring-2 ring-sakura/20"
                    : picked
                      ? "border-border-hover bg-paper text-ink"
                      : "border-border bg-surface text-ink hover:border-border-hover hover:bg-paper active:scale-[0.97]"
              } ${answerPending || answerResult ? "pointer-events-none" : ""}`}
              disabled={!canAnswer}
              onClick={() => onSubmitAnswer(option.optionKey)}
              type="button"
            >
              {option.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
