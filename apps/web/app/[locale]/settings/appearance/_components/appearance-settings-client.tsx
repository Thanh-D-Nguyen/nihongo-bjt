"use client";

import { Card, CardContent, PageHeader } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

/* ── Types ── */

type AppearanceLabels = {
  title: string;
  subtitle: string;
  themeLabel: string;
  themeLight: string;
  themeDark: string;
  themeSystem: string;
  fontSizeLabel: string;
  fontSizeSmall: string;
  fontSizeDefault: string;
  fontSizeLarge: string;
  fontSizeXl: string;
  densityLabel: string;
  densityCompact: string;
  densityComfortable: string;
  saved: string;
  preview: string;
  previewText: string;
};

type ThemeMode = "light" | "dark" | "system";
type FontSize = "small" | "default" | "large" | "xl";
type Density = "compact" | "comfortable";

const STORAGE_KEY = "nihongo-appearance";

type AppearanceState = {
  theme: ThemeMode;
  fontSize: FontSize;
  density: Density;
};

const DEFAULT_STATE: AppearanceState = {
  theme: "system",
  fontSize: "default",
  density: "comfortable",
};

function loadState(): AppearanceState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state: AppearanceState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ── Apply theme to DOM ── */

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function applyFontSize(size: FontSize) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.jpFontSize = size;
}

function applyDensity(density: Density) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.density = density;
}

/* ── Selection button ── */

function OptionButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-150 active:scale-[0.97] ${
        active
          ? "border-accent bg-accent/10 text-accent shadow-sm"
          : "border-ink/10 bg-surface text-ink hover:border-ink/20 hover:bg-paper"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

/* ── Section wrapper ── */

function SettingsSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/* ── Main ── */

export function AppearanceSettingsClient({
  labels,
  locale,
}: {
  labels: AppearanceLabels;
  locale: string;
}) {
  const [state, setState] = useState<AppearanceState>(DEFAULT_STATE);
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setState(loadState());
  }, []);

  const apply = useCallback(
    (next: AppearanceState) => {
      setState(next);
      saveState(next);
      applyTheme(next.theme);
      applyFontSize(next.fontSize);
      applyDensity(next.density);
      setSaved(true);
      const timer = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(timer);
    },
    []
  );

  useEffect(() => {
    if (!mounted) return;
    applyTheme(state.theme);
    applyFontSize(state.fontSize);
    applyDensity(state.density);
  }, [mounted, state]);

  // Listen for system theme changes
  useEffect(() => {
    if (state.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [state.theme]);

  const fontSizeMap: Record<FontSize, string> = {
    small: "text-sm",
    default: "text-base",
    large: "text-lg",
    xl: "text-xl",
  };

  return (
    <main className="w-full space-y-6 pb-12">
      <PageHeader
        title={labels.title}
        description={labels.subtitle}
      />

      <Card className="border-ink/8">
        <CardContent className="space-y-6 p-5 sm:p-6">
          {/* Theme */}
          <SettingsSection label={labels.themeLabel}>
            <OptionButton
              active={state.theme === "light"}
              onClick={() => apply({ ...state, theme: "light" })}
            >
              ☀️ {labels.themeLight}
            </OptionButton>
            <OptionButton
              active={state.theme === "dark"}
              onClick={() => apply({ ...state, theme: "dark" })}
            >
              🌙 {labels.themeDark}
            </OptionButton>
            <OptionButton
              active={state.theme === "system"}
              onClick={() => apply({ ...state, theme: "system" })}
            >
              💻 {labels.themeSystem}
            </OptionButton>
          </SettingsSection>

          {/* Font size */}
          <SettingsSection label={labels.fontSizeLabel}>
            <OptionButton
              active={state.fontSize === "small"}
              onClick={() => apply({ ...state, fontSize: "small" })}
            >
              {labels.fontSizeSmall}
            </OptionButton>
            <OptionButton
              active={state.fontSize === "default"}
              onClick={() => apply({ ...state, fontSize: "default" })}
            >
              {labels.fontSizeDefault}
            </OptionButton>
            <OptionButton
              active={state.fontSize === "large"}
              onClick={() => apply({ ...state, fontSize: "large" })}
            >
              {labels.fontSizeLarge}
            </OptionButton>
            <OptionButton
              active={state.fontSize === "xl"}
              onClick={() => apply({ ...state, fontSize: "xl" })}
            >
              {labels.fontSizeXl}
            </OptionButton>
          </SettingsSection>

          {/* Density */}
          <SettingsSection label={labels.densityLabel}>
            <OptionButton
              active={state.density === "compact"}
              onClick={() => apply({ ...state, density: "compact" })}
            >
              {labels.densityCompact}
            </OptionButton>
            <OptionButton
              active={state.density === "comfortable"}
              onClick={() => apply({ ...state, density: "comfortable" })}
            >
              {labels.densityComfortable}
            </OptionButton>
          </SettingsSection>

          {/* Save confirmation */}
          {saved ? (
            <p className="text-sm font-medium text-leaf" role="status">
              ✓ {labels.saved}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="border-ink/8">
        <CardContent className="space-y-3 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            {labels.preview}
          </p>
          <p
            className={`leading-[1.8] text-ink ${fontSizeMap[state.fontSize] ?? "text-base"}`}
            lang="ja"
          >
            {labels.previewText}
          </p>
        </CardContent>
      </Card>

      {/* Back link */}
      <Link
        className="text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
        href={`/${locale}/settings`}
      >
        ← {labels.title}
      </Link>
    </main>
  );
}
