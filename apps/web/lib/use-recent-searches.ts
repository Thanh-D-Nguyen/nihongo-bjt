"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "nihongo-bjt:recent-searches";
const MAX_ITEMS = 8;

let listeners: Array<() => void> = [];
let cachedSnapshot: string[] = [];
const SERVER_SNAPSHOT: string[] = [];

function emitChange() {
  cachedSnapshot = readStorage();
  for (const listener of listeners) listener();
}

function readStorage(): string[] {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

// Initialize cache on module load (client only)
if (typeof window !== "undefined") {
  cachedSnapshot = readStorage();
}

function getSnapshot(): string[] {
  return cachedSnapshot;
}

function getServerSnapshot(): string[] {
  return SERVER_SNAPSHOT;
}

function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function useRecentSearches() {
  const searches = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addSearch = useCallback((query: string) => {
    const q = query.trim();
    if (!q) return;
    const current = getSnapshot().filter((item) => item !== q);
    const next = [q, ...current].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    emitChange();
  }, []);

  const removeSearch = useCallback((query: string) => {
    const next = getSnapshot().filter((item) => item !== query);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    emitChange();
  }, []);

  const clearAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    emitChange();
  }, []);

  return { searches, addSearch, removeSearch, clearAll };
}
