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
                ? "bg-sakura-soft text-sakura-strong"
                : isUrgent
                  ? "bg-orange-500/15 text-orange-800"
                  : "bg-amber-soft text-amber-strong"
            }`}>
              ⚡+{speedBonus}
            </span>
          </div>
        )}
      </div>

      {/* Question — full width, clear reading */}
      <div className={`rounded-2xl border px-4 py-4 transition-all ${
        isCritical
          ? "border-sakura/30 bg-gradient-to-br from-sakura-soft/50 to-surface"
          : isUrgent
            ? "border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-surface"
            : "border-ink/10 bg-surface"
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
                  ? "border-leaf/40 bg-leaf-soft text-leaf-strong ring-2 ring-leaf/30"
                  : wrong
                    ? "border-sakura/50 bg-sakura-soft text-sakura-strong ring-2 ring-sakura/30"
                    : picked
                      ? "border-amber/50 bg-amber-soft text-amber-strong ring-1 ring-amber/30"
                      : "border-ink/10 bg-surface text-ink hover:border-amber/40 hover:bg-amber-soft/40 hover:shadow-md hover:shadow-amber/5 active:scale-[0.97] active:bg-amber-soft/70"
              } ${answerPending || answerResult ? "pointer-events-none" : ""}`}
              disabled={!canAnswer}
              onClick={() => onSubmitAnswer(option.optionKey)}
              type="button"
            >
              {/* Option key badge */}
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                correct
                  ? "bg-leaf/20 text-leaf-strong"
                  : wrong
                    ? "bg-sakura/20 text-sakura-strong"
                    : picked
                      ? "bg-amber/20 text-amber-strong"
                      : "bg-ink/5 text-muted group-hover:bg-amber-soft group-hover:text-amber-strong"
              }`}>
                {idx < 26 ? String.fromCharCode(65 + idx) : idx + 1}
              </span>
              {/* Option text */}
              <span className="flex-1">{option.text}</span>
              {/* Speed indicator on hover */}
              {canAnswer && !answerResult && (
                <span className="hidden text-[10px] font-bold text-amber-strong opacity-0 transition-opacity group-hover:opacity-100 sm:inline">
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
            ? "border-leaf/25 bg-leaf-soft text-leaf-strong"
            : "border-sakura/30 bg-sakura-soft text-sakura-strong"
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
