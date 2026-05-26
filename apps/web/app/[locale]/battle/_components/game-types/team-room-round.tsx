"use client";

import type { GameTypeRoundProps } from "./shared-props";

/**
 * Team Room: Collaborative MC.
 * Same MC but with team presence indicators showing who answered.
 * (In real multiplayer, server would push team answers live.)
 */
export function TeamRoomRound({
  answerPending,
  answerResult,
  canAnswer,
  onSubmitAnswer,
  round,
  selectedOptionKey
}: GameTypeRoundProps) {
  // Simulated team members (in production, these come from Socket.IO presence)
  const teamMembers = [
    { name: "You", answered: !!selectedOptionKey || !!answerResult, color: "bg-blue-500" },
    { name: "Ally 1", answered: answerPending || !!answerResult, color: "bg-green-500" },
    { name: "Ally 2", answered: !!answerResult, color: "bg-purple-500" }
  ];

  return (
    <div className="space-y-4">
      {/* Team header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>👥</span>
          <span className="text-xs font-black uppercase text-blue-600">Team Room</span>
        </div>
        {/* Team status dots */}
        <div className="flex items-center gap-1.5">
          {teamMembers.map((m) => (
            <div key={m.name} className="flex items-center gap-1" title={m.name}>
              <div className={`h-3 w-3 rounded-full ${m.color} ${m.answered ? "ring-2 ring-leaf/50" : "opacity-50"}`} />
              <span className="text-[9px] font-bold text-muted hidden sm:inline">{m.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Team consensus bar */}
      <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">
        <div className="flex items-center justify-between text-[10px] font-bold text-blue-700">
          <span>Team consensus</span>
          <span>{teamMembers.filter(m => m.answered).length}/{teamMembers.length} answered</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-blue-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
            style={{ width: `${(teamMembers.filter(m => m.answered).length / teamMembers.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <p className="rounded-xl border border-ink/10 bg-paper/70 p-4 text-base font-semibold leading-7 text-ink">
        {round.question.prompt}
      </p>

      {/* Options with team vote indicators */}
      <div className="grid gap-2 sm:grid-cols-2">
        {round.question.options.map((option) => {
          const picked = selectedOptionKey === option.optionKey;
          const correct = answerResult?.correctOptionKey === option.optionKey;
          const wrong = picked && answerResult && !answerResult.userCorrect;
          return (
            <button
              key={option.optionKey}
              className={`relative min-h-14 rounded-xl border px-4 py-3 text-left text-sm font-bold leading-5 transition-all ${
                correct
                  ? "border-leaf/40 bg-leaf/10 text-leaf ring-2 ring-leaf/20"
                  : wrong
                    ? "border-red-300 bg-red-50 text-red-700 ring-2 ring-red-200"
                    : picked
                      ? "border-blue-300 bg-blue-50 text-blue-800"
                      : "border-ink/10 bg-white text-ink hover:border-blue-200 hover:bg-blue-50/30 active:scale-[0.97]"
              } ${answerPending || answerResult ? "pointer-events-none" : ""}`}
              disabled={!canAnswer}
              onClick={() => onSubmitAnswer(option.optionKey)}
              type="button"
            >
              {option.text}
              {/* Team vote indicator after answer */}
              {answerResult && correct && (
                <span className="absolute -top-1.5 -right-1.5 flex gap-0.5">
                  <span className="h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
                  <span className="h-3 w-3 rounded-full bg-purple-500 ring-2 ring-white" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
