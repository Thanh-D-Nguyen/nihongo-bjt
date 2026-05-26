"use client";

import type { GameTypeRoundProps } from "./shared-props";

/**
 * Speed Duel: Adrenaline-focused speed battle.
 * Horizontal shrinking timer bar, live speed bonus drain,
 * large slam-button options optimized for fast tapping.
 * The faster you answer correctly, the more bonus points.
 */
export function SpeedDuelRound({
  answerPending,
  answerResult,
  canAnswer,
  onSubmitAnswer,
  round,
  selectedOptionKey,
  timeLeft
}: GameTypeRoundProps) {
  const timeLimitSec = round.timeLimitSec;
  const timeRatio = timeLeft != null ? Math.max(0, timeLeft / timeLimitSec) : 1;
  const isUrgent = timeRatio < 0.3;
  const isCritical = timeRatio < 0.15;
  const speedBonus = timeLeft != null ? Math.max(0, Math.floor(timeLeft * 10)) : 0;

  // Color transitions based on urgency
  const barColor = isCritical
    ? "bg-red-500"
    : isUrgent
      ? "bg-orange-500"
      : "bg-amber-500";

  const barGlow = isCritical
    ? "shadow-red-500/40"
    : isUrgent
      ? "shadow-orange-500/30"
      : "shadow-amber-500/20";

  return (
    <div className="space-y-3">
      {/* Speed timer bar — full width, shrinks from right */}
      <div className="relative">
        {/* Track */}
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink/5">
          {/* Fill — transitions smoothly, urgent shake */}
          <div
            className={`h-full rounded-full shadow-lg transition-all duration-1000 ease-linear ${barColor} ${barGlow} ${
              isCritical ? "animate-[pulse_0.4s_ease-in-out_infinite]" : ""
            }`}
            style={{ width: `${timeRatio * 100}%` }}
          />
        </div>
        {/* Speed bonus floating above bar */}
        {canAnswer && !answerResult && (
          <div className={`absolute -top-7 transition-all duration-300 ${
            isUrgent ? "animate-bounce" : ""
          }`} style={{ left: `${Math.max(5, timeRatio * 100 - 5)}%` }}>
            <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-black tabular-nums ${
              isCritical
                ? "bg-red-100 text-red-700"
                : isUrgent
                  ? "bg-orange-100 text-orange-700"
                  : "bg-amber-100 text-amber-700"
            }`}>
              ⚡+{speedBonus}
            </span>
          </div>
        )}
      </div>

      {/* Question — full width, clear reading */}
      <div className={`rounded-2xl border px-4 py-4 transition-all ${
        isCritical
          ? "border-red-200/60 bg-gradient-to-br from-red-50/40 to-white"
          : isUrgent
            ? "border-orange-200/40 bg-gradient-to-br from-orange-50/30 to-white"
            : "border-ink/10 bg-white"
      }`}>
        <p className="text-base font-semibold leading-7 text-ink sm:text-lg" lang="ja">
          {round.question.prompt}
        </p>
      </div>

      {/* Slam-button options — large, easy to tap fast */}
      <div className="grid gap-2">
        {round.question.options.map((option, idx) => {
          const picked = selectedOptionKey === option.optionKey;
          const correct = answerResult?.correctOptionKey === option.optionKey;
          const wrong = picked && answerResult && !answerResult.userCorrect;
          // Stagger subtle entrance delay per option
          const delayClass = idx === 0 ? "" : idx === 1 ? "delay-[50ms]" : idx === 2 ? "delay-[100ms]" : "delay-[150ms]";
          return (
            <button
              key={option.optionKey}
              className={`group relative flex min-h-[52px] items-center gap-3 overflow-hidden rounded-xl border px-4 py-3 text-left text-sm font-bold leading-5 transition-all duration-150 ${delayClass} ${
                correct
                  ? "border-leaf/40 bg-leaf/10 text-leaf ring-2 ring-leaf/30"
                  : wrong
                    ? "border-red-400 bg-red-50 text-red-700 ring-2 ring-red-300"
                    : picked
                      ? "border-amber-400 bg-amber-50 text-amber-800 ring-1 ring-amber-300"
                      : "border-ink/10 bg-white text-ink hover:border-amber-300 hover:bg-amber-50/40 hover:shadow-md hover:shadow-amber-500/5 active:scale-[0.97] active:bg-amber-100/50"
              } ${answerPending || answerResult ? "pointer-events-none" : ""}`}
              disabled={!canAnswer}
              onClick={() => onSubmitAnswer(option.optionKey)}
              type="button"
            >
              {/* Option key badge */}
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                correct
                  ? "bg-leaf/20 text-leaf"
                  : wrong
                    ? "bg-red-200 text-red-700"
                    : picked
                      ? "bg-amber-200 text-amber-800"
                      : "bg-ink/5 text-muted group-hover:bg-amber-100 group-hover:text-amber-700"
              }`}>
                {option.optionKey}
              </span>
              {/* Option text */}
              <span className="flex-1">{option.text}</span>
              {/* Speed indicator on hover */}
              {canAnswer && !answerResult && (
                <span className="hidden text-[10px] font-bold text-amber-500 opacity-0 transition-opacity group-hover:opacity-100 sm:inline">
                  TAP!
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Post-answer speed result */}
      {answerResult && (
        <div className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center text-sm font-black ${
          answerResult.userCorrect
            ? "border-leaf/20 bg-leaf/5 text-leaf"
            : "border-red-200 bg-red-50/50 text-red-600"
        }`}>
          {answerResult.userCorrect ? (
            <>⚡ Speed Bonus: +{speedBonus} pts</>
          ) : (
            <>💨 Too slow or wrong!</>
          )}
        </div>
      )}
    </div>
  );
}
