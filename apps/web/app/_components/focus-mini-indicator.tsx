"use client";

import { cn } from "@nihongo-bjt/ui";

import { useFocusTimer } from "../_hooks/use-focus-timer";

export interface FocusMiniIndicatorLabels {
  active: string;
  stop: string;
  completed: string;
  dismiss: string;
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function FocusMiniIndicator({ labels }: { labels: FocusMiniIndicatorLabels }) {
  const { activeSession, remaining, completed, stopSession, dismissCompleted } = useFocusTimer();

  // Show completed toast briefly
  if (completed) {
    return (
      <aside
        aria-live="polite"
        className={cn(
          "fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 z-[71]",
          "flex items-center gap-2 rounded-2xl border border-[var(--color-gold,#f59e0b)]/30 bg-[var(--color-gold,#f59e0b)]/10 px-3 py-2.5 shadow-lg backdrop-blur-xl",
          "dark:border-[var(--color-gold,#f59e0b)]/20 dark:bg-slate-900/90",
          "sm:left-5 lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]",
          "animate-in slide-in-from-left-4 fade-in duration-300"
        )}
      >
        <span className="text-lg">🎉</span>
        <span className="text-xs font-bold text-ink">{labels.completed}</span>
        <button
          className="ml-1 grid h-7 w-7 place-items-center rounded-lg text-xs text-muted hover:bg-ink/10 transition"
          onClick={dismissCompleted}
          type="button"
          aria-label={labels.dismiss}
        >
          ✕
        </button>
      </aside>
    );
  }

  if (!activeSession || remaining <= 0) return null;

  const totalSecs = activeSession.durationMinutes * 60;
  const progress = 1 - remaining / totalSecs;

  return (
    <aside
      aria-label={labels.active}
      className={cn(
        "fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-3 z-[71]",
        "flex items-center gap-2.5 rounded-2xl border border-[var(--color-matcha)]/30 bg-[var(--color-matcha)]/8 px-3 py-2 shadow-lg backdrop-blur-xl",
        "dark:border-[var(--color-matcha)]/20 dark:bg-slate-900/90",
        "sm:left-5 lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]",
        "animate-in slide-in-from-left-4 fade-in duration-300"
      )}
    >
      {/* Mini circular progress */}
      <div className="relative h-9 w-9 shrink-0">
        <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
          <circle
            cx="18" cy="18" r="15"
            fill="none" stroke="currentColor" strokeWidth="3"
            className="text-ink/10"
          />
          <circle
            cx="18" cy="18" r="15"
            fill="none" stroke="var(--color-matcha, #22c55e)" strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 15}
            strokeDashoffset={2 * Math.PI * 15 * (1 - progress)}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black tabular-nums text-ink">
          🎯
        </span>
      </div>

      {/* Time display */}
      <div className="min-w-0">
        <p className="text-sm font-black tabular-nums text-ink leading-tight">{formatTime(remaining)}</p>
        <p className="text-[10px] font-semibold text-muted leading-tight">{labels.active}</p>
      </div>

      {/* Stop button */}
      <button
        aria-label={labels.stop}
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[var(--color-sakura)]/30",
          "text-[var(--color-sakura)] text-xs font-black transition hover:bg-[var(--color-sakura)]/10 active:scale-95"
        )}
        onClick={() => void stopSession()}
        type="button"
      >
        ■
      </button>
    </aside>
  );
}
