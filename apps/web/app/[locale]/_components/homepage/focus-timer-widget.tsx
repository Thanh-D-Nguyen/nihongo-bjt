"use client";

import { cn } from "@nihongo-bjt/ui";
import { useState } from "react";
import { useFocusTimer } from "../../../_hooks/use-focus-timer";

const DURATION_OPTIONS = [15, 25, 45];
const RING_RADIUS = 40;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function FocusTimerWidget({ locale }: { locale: string }) {
  const {
    loading,
    activeSession,
    remaining,
    todayMinutes,
    todaySessions,
    completed,
    startSession,
    stopSession,
    dismissCompleted,
  } = useFocusTimer();
  const [selectedDuration, setSelectedDuration] = useState(15);

  if (loading) {
    return (
      <div className="rounded-2xl border border-ink/8 bg-surface p-4 shadow-sm animate-pulse">
        <div className="h-4 w-28 rounded bg-ink/10" />
        <div className="mt-4 mx-auto h-24 w-24 rounded-full bg-ink/5" />
      </div>
    );
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Completed state
  if (completed) {
    return (
      <div className="rounded-2xl border border-[var(--color-gold,#f59e0b)]/20 bg-[var(--color-gold,#f59e0b)]/5 p-4 shadow-sm text-center">
        <p className="text-2xl">🎉</p>
        <p className="mt-2 text-sm font-bold text-ink">Hoàn thành!</p>
        <p className="mt-1 text-xs text-muted">
          Hôm nay: {todayMinutes} phút · {todaySessions} phiên
        </p>
        <button
          onClick={dismissCompleted}
          className="mt-3 text-xs font-medium text-[var(--color-matcha)] underline"
        >
          Tiếp tục học
        </button>
      </div>
    );
  }

  // Active session
  if (activeSession && remaining > 0) {
    const totalSecs = activeSession.durationMinutes * 60;
    const progress = 1 - remaining / totalSecs;
    const dashOffset = RING_CIRCUMFERENCE * (1 - progress);

    return (
      <div className="rounded-2xl border border-[var(--color-matcha)]/20 bg-[var(--color-matcha)]/5 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">🎯 Đang tập trung</h3>
          <span className="text-[10px] text-muted">{activeSession.durationMinutes} phút</span>
        </div>

        <div className="mt-3 flex justify-center">
          <div className="relative">
            <svg width="96" height="96" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r={RING_RADIUS} fill="none" stroke="currentColor" strokeWidth="4" className="text-ink/10" />
              <circle
                cx="48" cy="48" r={RING_RADIUS}
                fill="none" stroke="var(--color-matcha, #22c55e)" strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                className="transition-all duration-1000 ease-linear"
                transform="rotate(-90 48 48)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-black tabular-nums text-ink">{formatTime(remaining)}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => void stopSession()}
          className="mt-3 w-full rounded-xl border border-[var(--color-sakura)]/30 py-2 text-sm font-medium text-[var(--color-sakura)] transition-transform active:scale-[0.97]"
        >
          Dừng lại
        </button>
      </div>
    );
  }

  // Idle state
  return (
    <div className="rounded-2xl border border-ink/8 bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-lg">⏱️</span>
        <h3 className="text-sm font-bold text-ink">Chế độ tập trung</h3>
      </div>

      {todayMinutes > 0 && (
        <p className="mt-1.5 text-xs text-muted">
          Hôm nay: {todayMinutes} phút · {todaySessions} phiên
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {DURATION_OPTIONS.map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDuration(d)}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-bold transition-all",
              selectedDuration === d
                ? "bg-[var(--color-matcha)] text-white shadow-sm"
                : "bg-ink/5 text-muted hover:bg-ink/10",
            )}
          >
            {d}m
          </button>
        ))}
      </div>

      <button
        onClick={() => void startSession(selectedDuration)}
        className="mt-3 w-full rounded-xl bg-[var(--color-matcha)] py-2.5 text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.97]"
      >
        Bắt đầu tập trung
      </button>
    </div>
  );
}
