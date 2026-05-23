"use client";

export type ThemeMode = "light" | "dark" | "system";
export type FontSizePreference = "small" | "default" | "large" | "xl";
export type DensityPreference = "compact" | "comfortable";

export type AppearanceState = {
  theme: ThemeMode;
  fontSize: FontSizePreference;
  density: DensityPreference;
};

export const APPEARANCE_STORAGE_KEY = "nihongo-appearance";
export const APPEARANCE_CHANGE_EVENT = "nihongo:appearance-change";

export const DEFAULT_APPEARANCE: AppearanceState = {
  density: "comfortable",
  fontSize: "default",
  theme: "system"
};

const themes = new Set<ThemeMode>(["light", "dark", "system"]);
const fontSizes = new Set<FontSizePreference>(["small", "default", "large", "xl"]);
const densities = new Set<DensityPreference>(["compact", "comfortable"]);

function normalizeAppearance(input: unknown): AppearanceState {
  const value = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const theme = themes.has(value.theme as ThemeMode) ? (value.theme as ThemeMode) : DEFAULT_APPEARANCE.theme;
  const fontSize = fontSizes.has(value.fontSize as FontSizePreference)
    ? (value.fontSize as FontSizePreference)
    : DEFAULT_APPEARANCE.fontSize;
  const density = densities.has(value.density as DensityPreference)
    ? (value.density as DensityPreference)
    : DEFAULT_APPEARANCE.density;
  return { density, fontSize, theme };
}

export function appearanceFromProfile(profile: unknown): AppearanceState {
  const value = profile && typeof profile === "object" ? (profile as Record<string, unknown>) : {};
  return normalizeAppearance({
    density: value.densityPreference,
    fontSize: value.fontSizePreference,
    theme: value.themeMode
  });
}

export function loadCachedAppearance(): AppearanceState {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    return normalizeAppearance(JSON.parse(raw));
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function cacheAppearance(state: AppearanceState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(state));
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("dark", isDark);
  root.setAttribute("data-theme", isDark ? "dark" : "light");
}

export function applyAppearance(state: AppearanceState) {
  if (typeof document === "undefined") return;
  applyTheme(state.theme);
  document.documentElement.dataset.jpFontSize = state.fontSize;
  document.documentElement.dataset.density = state.density;
}

export function saveAppearance(state: AppearanceState) {
  cacheAppearance(state);
  applyAppearance(state);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<AppearanceState>(APPEARANCE_CHANGE_EVENT, { detail: state }));
  }
}
