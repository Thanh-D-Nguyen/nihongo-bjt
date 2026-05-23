"use client";

import { useEffect, useState } from "react";

import { useKeycloakAuth } from "../../components/auth/keycloak-auth-provider";
import {
  APPEARANCE_CHANGE_EVENT,
  APPEARANCE_STORAGE_KEY,
  type AppearanceState,
  appearanceFromProfile,
  applyAppearance,
  applyTheme,
  loadCachedAppearance,
  saveAppearance
} from "../../lib/appearance";
import { learnerApiFetch } from "../../lib/learner-api";

export function AppearanceSync() {
  const auth = useKeycloakAuth();
  const [activeTheme, setActiveTheme] = useState(() => loadCachedAppearance().theme);

  useEffect(() => {
    const cached = loadCachedAppearance();
    setActiveTheme(cached.theme);
    applyAppearance(cached);
  }, []);

  useEffect(() => {
    if (!auth.accessToken) return;
    let cancelled = false;

    async function syncServerAppearance() {
      const response = await learnerApiFetch("/api/auth/me");
      if (!response.ok || cancelled) return;
      const body = (await response.json()) as { profile?: unknown };
      const next = appearanceFromProfile(body.profile);
      if (cancelled) return;
      setActiveTheme(next.theme);
      saveAppearance(next);
    }

    void syncServerAppearance().catch(() => {
      const cached = loadCachedAppearance();
      setActiveTheme(cached.theme);
      applyAppearance(cached);
    });

    return () => {
      cancelled = true;
    };
  }, [auth.accessToken]);

  useEffect(() => {
    function onAppearanceChange(event: Event) {
      const next = (event as CustomEvent<AppearanceState>).detail ?? loadCachedAppearance();
      setActiveTheme(next.theme);
      applyAppearance(next);
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== APPEARANCE_STORAGE_KEY) return;
      const cached = loadCachedAppearance();
      setActiveTheme(cached.theme);
      applyAppearance(cached);
    }

    window.addEventListener(APPEARANCE_CHANGE_EVENT, onAppearanceChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(APPEARANCE_CHANGE_EVENT, onAppearanceChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (activeTheme !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, [activeTheme]);

  return null;
}
