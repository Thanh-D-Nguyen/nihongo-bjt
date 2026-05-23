"use client";

import type { ReadingAssistDisplayMode } from "@nihongo-bjt/shared";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { learnerApiFetch } from "../learner-api";

type ReadingAssistContextType = {
  // User preferences
  displayMode: ReadingAssistDisplayMode;
  showRomaji: boolean;
  setDisplayMode: (mode: ReadingAssistDisplayMode) => void;
  setShowRomaji: (value: boolean) => void;

  // Exam context
  examContext: {
    kind: "bjt_quiz";
    mode: "timed" | "practice";
    answerSubmitted: boolean;
  } | null;
  setExamContext: (ctx: ReadingAssistContextType["examContext"]) => void;

  // Preferences loading state
  preferencesLoading: boolean;
  preferencesError: string | null;
};

const ReadingAssistContext = createContext<ReadingAssistContextType | null>(null);

type Props = {
  children: React.ReactNode;
  userId: string;
};

/**
 * Provider for reading assist state: display mode, exam context, and user preferences.
 * Syncs preferences to backend on mount and when changed.
 *
 * Example:
 * ```tsx
 * <ReadingAssistProvider userId={userId}>
 *   <Page />
 * </ReadingAssistProvider>
 * ```
 */
export function ReadingAssistProvider({ children, userId }: Props) {
  const [displayMode, setDisplayMode] = useState<ReadingAssistDisplayMode>("hover");
  const [showRomaji, setShowRomaji] = useState(false);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [examContext, setExamContext] = useState<ReadingAssistContextType["examContext"]>(null);

  // Fetch preferences on mount
  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        setPreferencesLoading(true);
        setPreferencesError(null);
        const r = await learnerApiFetch(
          `/api/reading-assist/preferences?userId=${encodeURIComponent(userId)}`,
          {
          method: "GET"
          }
        );
        if (!r.ok) {
          setPreferencesError("fetch_error");
          return;
        }
        const prefs = (await r.json()) as {
          displayMode: ReadingAssistDisplayMode;
          showRomaji: boolean;
        };
        setDisplayMode(prefs.displayMode);
        setShowRomaji(prefs.showRomaji);
      } catch {
        setPreferencesError("network_error");
      } finally {
        setPreferencesLoading(false);
      }
    };

    void fetchPrefs();
  }, [userId]);

  const handleSetDisplayMode = useCallback(
    async (mode: ReadingAssistDisplayMode) => {
      setDisplayMode(mode);
      // Sync to backend
      try {
        await learnerApiFetch("/api/reading-assist/preferences", {
          body: JSON.stringify({
            displayMode: mode,
            userId
          }),
          headers: { "content-type": "application/json" },
          method: "PUT"
        });
      } catch {
        // Silently fail; local state is still updated
      }
    },
    [userId]
  );

  const handleSetShowRomaji = useCallback(
    async (value: boolean) => {
      setShowRomaji(value);
      // Sync to backend
      try {
        await learnerApiFetch("/api/reading-assist/preferences", {
          body: JSON.stringify({
            displayMode,
            showRomaji: value,
            userId
          }),
          headers: { "content-type": "application/json" },
          method: "PUT"
        });
      } catch {
        // Silently fail; local state is still updated
      }
    },
    [displayMode, userId]
  );

  const value: ReadingAssistContextType = {
    displayMode,
    examContext,
    preferencesError,
    preferencesLoading,
    setDisplayMode: handleSetDisplayMode,
    setExamContext,
    setShowRomaji: handleSetShowRomaji,
    showRomaji
  };

  return (
    <ReadingAssistContext.Provider value={value}>{children}</ReadingAssistContext.Provider>
  );
}

/**
 * Hook to access reading assist state.
 * Returns null if not wrapped by ReadingAssistProvider.
 *
 * Example:
 * ```tsx
 * const readingAssist = useReadingAssist();
 * if (!readingAssist) return null; // Not in provider
 * const { displayMode, setDisplayMode } = readingAssist;
 * ```
 */
export function useReadingAssist() {
  const ctx = useContext(ReadingAssistContext);
  if (!ctx) {
    return null;
  }
  return ctx;
}
