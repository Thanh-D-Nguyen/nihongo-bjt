"use client";

import { useCallback, useSyncExternalStore } from "react";

export const STUDY_FOCUS_MODE_KEY = "kiokoto:study-focus-mode:v1";
const STUDY_FOCUS_CHANGE_EVENT = "kiokoto:study-focus-change";

let fallbackValue = false;

export function readStudyFocusMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(STUDY_FOCUS_MODE_KEY);
    if (raw === null) return false;
    return raw === "true";
  } catch {
    return fallbackValue;
  }
}

export function writeStudyFocusMode(enabled: boolean): void {
  fallbackValue = enabled;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STUDY_FOCUS_MODE_KEY, enabled ? "true" : "false");
  } catch {
    // Private browsing or restricted storage should not break study sessions.
  }
  window.dispatchEvent(new CustomEvent<boolean>(STUDY_FOCUS_CHANGE_EVENT, { detail: enabled }));
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handleCustom = () => onStoreChange();
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STUDY_FOCUS_MODE_KEY) {
      onStoreChange();
    }
  };
  window.addEventListener(STUDY_FOCUS_CHANGE_EVENT, handleCustom);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(STUDY_FOCUS_CHANGE_EVENT, handleCustom);
    window.removeEventListener("storage", handleStorage);
  };
}

function getServerSnapshot(): boolean {
  return false;
}

export function useStudyFocusMode() {
  const focused = useSyncExternalStore(subscribe, readStudyFocusMode, getServerSnapshot);

  const setFocused = useCallback((next: boolean) => {
    writeStudyFocusMode(next);
  }, []);

  const toggle = useCallback(() => {
    writeStudyFocusMode(!readStudyFocusMode());
  }, []);

  return { focused, setFocused, toggle };
}
