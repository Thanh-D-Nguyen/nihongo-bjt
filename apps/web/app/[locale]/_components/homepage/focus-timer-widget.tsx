"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";

const DURATION_OPTIONS = [15, 25, 45];
const RING_RADIUS = 40;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface ActiveSession {
  id: string;
  mode: string;
  durationMinutes: number;
  startedAt: string;
}

export function FocusTimerWidget({ locale }: { locale: string }) {
  const { userId } = useKeycloakAuth();
  const [loading, setLoading] = useState(true);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [todaySessions, setTodaySessions] = useState(0);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(15);
  const [remaining, setRemaining] = useState(0); // seconds
  const [completed, setCompleted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const endSession = useCallback(async (sessionId: string, isComplete: boolean, durationMin?: number) => {
    try {
      await learnerApiFetch("/api/gamification/focus/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, completed: isComplete }),
      });
    } catch { /* no-op */ }
    setActiveSession(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isComplete) {
      setCompleted(true);
      setTodayMinutes((m) => m + (durationMin ?? 0));
      setTodaySessions((s) => s + 1);
    }
  }, []);

  const loadStats = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await learnerApiFetch("/api/gamification/focus/today");
      if (r.ok) {
        const data = await r.json();
        setTodayMinutes(data.todayMinutes ?? 0);
        setTodaySessions(data.todaySessions ?? 0);
        if (data.activeSession) {
          setActiveSession(data.activeSession);
          // Calculate remaining time
          const started = new Date(data.activeSession.startedAt).getTime();
          const total = data.activeSession.durationMinutes * 60 * 1000;
          const elapsed = Date.now() - started;
          const rem = Math.max(0, Math.floor((total - elapsed) / 1000));
          setRemaining(rem);
          if (rem <= 0) {
            // Session already expired, auto-complete
            await endSession(data.activeSession.id, true, data.activeSession.durationMinutes);
          }
        }
      }
    } catch { /* no-op */ } finally {
      setLoading(false);
    }
  }, [userId, endSession]);

  useEffect(() => { void loadStats(); }, [loadStats]);

  // Countdown timer
  useEffect(() => {
    if (!activeSession || remaining <= 0) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current!);
          void endSession(activeSession.id, true, activeSession.durationMinutes);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeSession?.id, activeSession?.durationMinutes, endSession, remaining]);

  const startSession = async () => {
    try {
      const r = await learnerApiFetch("/api/gamification/focus/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationMinutes: selectedDuration, mode: "focus" }),
      });
      if (r.ok) {
        const data = await r.json();
        setActiveSession(data);
        setRemaining(selectedDuration * 60);
        setCompleted(false);
      }
    } catch { /* no-op */ }
  };

  if (!userId) return null;

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
          onClick={() => setCompleted(false)}
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
          onClick={() => void endSession(activeSession.id, false)}
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
        onClick={() => void startSession()}
        className="mt-3 w-full rounded-xl bg-[var(--color-matcha)] py-2.5 text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.97]"
      >
        Bắt đầu tập trung
      </button>
    </div>
  );
}
