"use client";

import { useEffect, useState } from "react";

import {
  type AppearanceState,
  loadCachedAppearance,
  persistAppearanceToServer,
  saveAppearance
} from "../../lib/appearance";
import { IconMoon, IconSun } from "./app-icons";

export type ThemeToggleLabels = {
  themeToggleToDark: string;
  themeToggleToLight: string;
};

function documentIsDark() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

/**
 * Header light/dark switch. Reuses the shared appearance store: an explicit choice overrides
 * "system", is cached locally (and applied via .dark/data-theme), and for signed-in learners is
 * saved to the profile with the same request the appearance settings page sends.
 */
export function ThemeToggle({ isAuthenticated, labels }: { isAuthenticated: boolean; labels: ThemeToggleLabels }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const sync = () => setIsDark(documentIsDark());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributeFilter: ["class", "data-theme"], attributes: true });
    return () => observer.disconnect();
  }, []);

  function toggle() {
    const next: AppearanceState = { ...loadCachedAppearance(), theme: documentIsDark() ? "light" : "dark" };
    saveAppearance(next);
    setIsDark(next.theme === "dark");
    if (!isAuthenticated) return;
    persistAppearanceToServer(next)
      .then((response) => {
        if (!response.ok) console.warn(`[theme-toggle] profile appearance not saved (HTTP ${response.status}); kept the local choice`);
      })
      .catch((error: unknown) => {
        console.warn("[theme-toggle] profile appearance not saved; kept the local choice", error);
      });
  }

  const label = isDark ? labels.themeToggleToLight : labels.themeToggleToDark;
  return (
    <button
      aria-label={label}
      className="inline-flex size-10 items-center justify-center rounded-xl border border-ink/8 bg-surface text-muted shadow-sm transition hover:border-ink/15 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40"
      title={label}
      type="button"
      onClick={toggle}
    >
      {isDark ? <IconSun aria-hidden size={18} /> : <IconMoon aria-hidden size={18} />}
    </button>
  );
}
