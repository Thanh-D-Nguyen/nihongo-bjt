"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { useKeycloakAuth } from "../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../lib/learner-api";

interface ActiveSession {
  id: string;
  mode: string;
  durationMinutes: number;
  startedAt: string;
}

interface FocusTimerState {
  /** Whether initial data is still loading */
  loading: boolean;
  /** Currently active focus session (null if idle) */
  activeSession: ActiveSession | null;
  /** Seconds remaining in current session */
  remaining: number;
  /** Total focused minutes today */
  todayMinutes: number;
  /** Total sessions completed today */
  todaySessions: number;
  /** Whether last session was just completed (for celebration) */
  completed: boolean;
}

interface FocusTimerActions {
  startSession: (durationMinutes: number) => Promise<void>;
  stopSession: () => Promise<void>;
  dismissCompleted: () => void;
}

type FocusTimerContextValue = FocusTimerState & FocusTimerActions;

const FocusTimerContext = createContext<FocusTimerContextValue>({
  loading: true,
  activeSession: null,
  remaining: 0,
  todayMinutes: 0,
  todaySessions: 0,
  completed: false,
  startSession: async () => {},
  stopSession: async () => {},
  dismissCompleted: () => {},
});

export function useFocusTimer() {
  return useContext(FocusTimerContext);
}

export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const { userId } = useKeycloakAuth();
  const [loading, setLoading] = useState(true);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [todaySessions, setTodaySessions] = useState(0);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [completed, setCompleted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const endSession = useCallback(async (sessionId: string, isComplete: boolean, durationMin?: number) => {
    try {
      await learnerApiFetch("/api/gamification/focus/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, completed: isComplete }),
      });
    } catch { /* network error — session will reconcile on next load */ }
    setActiveSession(null);
    clearTimer();
    if (isComplete) {
      setCompleted(true);
      setTodayMinutes((m) => m + (durationMin ?? 0));
      setTodaySessions((s) => s + 1);
    }
  }, [clearTimer]);

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
          const started = new Date(data.activeSession.startedAt).getTime();
          const total = data.activeSession.durationMinutes * 60 * 1000;
          const elapsed = Date.now() - started;
          const rem = Math.max(0, Math.floor((total - elapsed) / 1000));
          if (rem <= 0) {
            await endSession(data.activeSession.id, true, data.activeSession.durationMinutes);
          } else {
            setRemaining(rem);
          }
        }
      }
    } catch { /* no-op */ } finally {
      setLoading(false);
    }
  }, [userId, endSession]);

  useEffect(() => { void loadStats(); }, [loadStats]);

  // Countdown tick
  useEffect(() => {
    if (!activeSession || remaining <= 0) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearTimer();
          void endSession(activeSession.id, true, activeSession.durationMinutes);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id]);

  const startSession = useCallback(async (durationMinutes: number) => {
    try {
      const r = await learnerApiFetch("/api/gamification/focus/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationMinutes, mode: "focus" }),
      });
      if (r.ok) {
        const data = await r.json();
        setActiveSession(data);
        setRemaining(durationMinutes * 60);
        setCompleted(false);
      }
    } catch { /* no-op */ }
  }, []);

  const stopSession = useCallback(async () => {
    if (activeSession) {
      await endSession(activeSession.id, false);
    }
  }, [activeSession, endSession]);

  const dismissCompleted = useCallback(() => {
    setCompleted(false);
  }, []);

  return (
    <FocusTimerContext.Provider
      value={{
        loading,
        activeSession,
        remaining,
        todayMinutes,
        todaySessions,
        completed,
        startSession,
        stopSession,
        dismissCompleted,
      }}
    >
      {children}
    </FocusTimerContext.Provider>
  );
}
