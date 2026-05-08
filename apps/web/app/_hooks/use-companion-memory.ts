"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "nihongo_companion_memory";
const MAX_MESSAGES_SEEN = 50;

export type CompanionMemoryState = {
  /** ISO string of first visit */
  firstSeen: string;
  /** ISO string of last visit */
  lastSeen: string;
  /** Onboarding step completed (0 = not started, -1 = dismissed) */
  onboardingStep: number;
  /** IDs of messages the user has already seen */
  messagesSeen: string[];
  /** How many times the user has opened the panel */
  panelOpenCount: number;
  /** Whether the user has explicitly muted proactive bubbles */
  bubbleMuted: boolean;
  /** Consecutive days visited (client-side approximation) */
  localStreakDays: number;
  /** Last date key (YYYY-MM-DD) the user visited */
  lastDateKey: string;
  /** Celebration IDs that have been shown */
  celebrationsShown: string[];
};

const EMPTY_MEMORY: CompanionMemoryState = {
  firstSeen: "",
  lastSeen: "",
  onboardingStep: 0,
  messagesSeen: [],
  panelOpenCount: 0,
  bubbleMuted: false,
  localStreakDays: 0,
  lastDateKey: "",
  celebrationsShown: [],
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadMemory(): CompanionMemoryState {
  if (typeof window === "undefined") return { ...EMPTY_MEMORY };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_MEMORY };
    const parsed = JSON.parse(raw) as Partial<CompanionMemoryState>;
    return { ...EMPTY_MEMORY, ...parsed };
  } catch {
    return { ...EMPTY_MEMORY };
  }
}

function saveMemory(state: CompanionMemoryState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or disabled — graceful degradation
  }
}

export function useCompanionMemory() {
  const [memory, setMemory] = useState<CompanionMemoryState>(EMPTY_MEMORY);
  const initialized = useRef(false);

  // Load on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const loaded = loadMemory();
    const now = new Date().toISOString();
    const today = todayKey();

    // Update visit tracking
    if (!loaded.firstSeen) loaded.firstSeen = now;
    loaded.lastSeen = now;

    // Streak calculation (client-side approximation)
    if (loaded.lastDateKey) {
      const lastDate = new Date(loaded.lastDateKey);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / 86400000);
      if (diffDays === 1) {
        loaded.localStreakDays += 1;
      } else if (diffDays > 1) {
        loaded.localStreakDays = 1;
      }
      // diffDays === 0 means same day, keep streak
    } else {
      loaded.localStreakDays = 1;
    }
    loaded.lastDateKey = today;

    saveMemory(loaded);
    setMemory(loaded);
  }, []);

  const update = useCallback((patch: Partial<CompanionMemoryState>) => {
    setMemory((prev) => {
      const next = { ...prev, ...patch };
      // Trim messagesSeen to prevent unbounded growth
      if (next.messagesSeen.length > MAX_MESSAGES_SEEN) {
        next.messagesSeen = next.messagesSeen.slice(-MAX_MESSAGES_SEEN);
      }
      if (next.celebrationsShown.length > MAX_MESSAGES_SEEN) {
        next.celebrationsShown = next.celebrationsShown.slice(-MAX_MESSAGES_SEEN);
      }
      saveMemory(next);
      return next;
    });
  }, []);

  const markMessageSeen = useCallback((id: string) => {
    setMemory((prev) => {
      if (prev.messagesSeen.includes(id)) return prev;
      const next = { ...prev, messagesSeen: [...prev.messagesSeen, id].slice(-MAX_MESSAGES_SEEN) };
      saveMemory(next);
      return next;
    });
  }, []);

  const markCelebrationShown = useCallback((id: string) => {
    setMemory((prev) => {
      if (prev.celebrationsShown.includes(id)) return prev;
      const next = { ...prev, celebrationsShown: [...prev.celebrationsShown, id] };
      saveMemory(next);
      return next;
    });
  }, []);

  const incrementPanelOpen = useCallback(() => {
    setMemory((prev) => {
      const next = { ...prev, panelOpenCount: prev.panelOpenCount + 1 };
      saveMemory(next);
      return next;
    });
  }, []);

  const isFirstVisit = memory.firstSeen === memory.lastSeen && memory.panelOpenCount === 0;
  const daysSinceFirstVisit = memory.firstSeen
    ? Math.floor((Date.now() - new Date(memory.firstSeen).getTime()) / 86400000)
    : 0;

  return {
    memory,
    update,
    markMessageSeen,
    markCelebrationShown,
    incrementPanelOpen,
    isFirstVisit,
    daysSinceFirstVisit,
  };
}
