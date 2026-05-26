"use client";

import type { GameTypeRoundProps } from "./shared-props";

/**
 * Tournament: MC with bracket progression.
 * Standard MC but framed as elimination rounds with bracket visualization.
 */
export function TournamentRound({
  answerPending,
  answerResult,
  canAnswer,
  onSubmitAnswer,
  round,
  selectedOptionKey
}: GameTypeRoundProps) {
  const totalRounds = round.totalRounds;
  const currentRound = round.roundIndex;

  // Derive tournament round name
  const roundName = totalRounds <= 4
    ? ["Semifinal", "Final", "Grand Final", "Champion"][currentRound] ?? `Round ${currentRound + 1}`
    : currentRound >= totalRounds - 1
      ? "Final"
      : currentRound >= totalRounds - 2
        ? "Semifinal"
        : `Round of ${Math.pow(2, totalRounds - currentRound)}`;

  return (
    <div className="space-y-4">
      {/* Tournament header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>🏆</span>
          <span className="text-xs font-black uppercase text-amber-700">Tournament</span>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-black text-amber-700">
          {roundName}
        </span>
      </div>

      {/* Bracket progress */}
      <div className="rounded-xl border border-amber-100 bg-gradient-to-r from-amber-50/50 to-yellow-50/30 px-3 py-2.5">
        <div className="flex items-center justify-between text-[10px] font-bold text-amber-700 mb-1.5">
          <span>Tournament Progress</span>
          <span>{currentRound + 1}/{totalRounds}</span>
        </div>
        {/* Mini bracket visualization */}
        <div className="flex items-center gap-1">
          {Array.from({ length: totalRounds }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div className={`h-1.5 w-full rounded-full transition-all ${
                i < currentRound
                  ? "bg-amber-500"
                  : i === currentRound
                    ? "bg-amber-400 animate-pulse"
                    : "bg-amber-100"
              }`} />
              {i === totalRounds - 1 && (
                <span className="text-[8px]">🏆</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Question */}
      <p className="rounded-xl border border-ink/10 bg-white p-4 text-base font-semibold leading-7 text-ink shadow-sm">
        {round.question.prompt}
      </p>

      {/* Options */}
      <div className="grid gap-2 sm:grid-cols-2">
        {round.question.options.map((option) => {
          const picked = selectedOptionKey === option.optionKey;
          const correct = answerResult?.correctOptionKey === option.optionKey;
          const wrong = picked && answerResult && !answerResult.userCorrect;
          return (
            <button
              key={option.optionKey}
              className={`min-h-14 rounded-xl border px-4 py-3 text-left text-sm font-bold leading-5 transition-all ${
                correct
                  ? "border-amber-300 bg-amber-50 text-amber-800 ring-2 ring-amber-200"
                  : wrong
                    ? "border-red-300 bg-red-50 text-red-700 ring-2 ring-red-200"
                    : picked
                      ? "border-amber-300 bg-amber-50/50 text-amber-800"
                      : "border-ink/10 bg-white text-ink hover:border-amber-200 hover:bg-amber-50/30 active:scale-[0.97]"
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
