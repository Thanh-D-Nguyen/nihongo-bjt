"use client";

import { Card, CardContent, PageHeader } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useKeycloakAuth } from "../../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../../lib/learner-api";

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

function loadCachedState(): AppearanceState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

function cacheState(state: AppearanceState) {
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
    root.setAttribute("data-theme", "dark");
  } else {
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
  }
}

function applyFontSize(size: FontSize) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.jpFontSize = size;
}

function applyDensity(density: Density) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.density = density;
}

function applyAll(s: AppearanceState) {
  applyTheme(s.theme);
  applyFontSize(s.fontSize);
  applyDensity(s.density);
}

/* ── Main ── */

export function AppearanceSettingsClient({
  labels,
  locale,
}: {
  labels: AppearanceLabels;
  locale: string;
}) {
  const auth = useKeycloakAuth();
  const [state, setState] = useState<AppearanceState>(DEFAULT_STATE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load from localStorage immediately (fast), then sync from server
  useEffect(() => {
    setMounted(true);
    const cached = loadCachedState();
    setState(cached);
    applyAll(cached);

    // Fetch from server and reconcile
    if (auth.accessToken) {
      learnerApiFetch("/api/auth/me")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const profile = data?.profile;
          if (!profile) return;
          const serverState: AppearanceState = {
            theme: (profile.themeMode as ThemeMode) || "system",
            fontSize: (profile.fontSizePreference as FontSize) || "default",
            density: (profile.densityPreference as Density) || "comfortable",
          };
          setState(serverState);
          cacheState(serverState);
          applyAll(serverState);
        })
        .catch(() => { /* use cached */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.accessToken]);

  // Listen for system theme changes
  useEffect(() => {
    if (state.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [state.theme]);

  // Persist to server (debounced)
  const persistToServer = useCallback(
    (next: AppearanceState) => {
      if (!auth.accessToken) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await learnerApiFetch("/api/auth/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              themeMode: next.theme,
              fontSizePreference: next.fontSize,
              densityPreference: next.density,
            }),
          });
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        } catch { /* silent */ }
        finally { setSaving(false); }
      }, 600);
    },
    [auth.accessToken]
  );

  const apply = useCallback(
    (next: AppearanceState) => {
      setState(next);
      cacheState(next);
      applyAll(next);
      persistToServer(next);
    },
    [persistToServer]
  );

  const fontSizeMap: Record<FontSize, string> = {
    small: "text-sm",
    default: "text-base",
    large: "text-lg",
    xl: "text-xl",
  };

  if (!mounted) {
    return (
      <main className="w-full space-y-6 pb-12">
        <PageHeader title={labels.title} description={labels.subtitle} />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-ink/5" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="w-full space-y-6 pb-12">
      <PageHeader title={labels.title} description={labels.subtitle} />

      {/* ── Theme Selection ── */}
      <Card className="overflow-hidden border-ink/8">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">{labels.themeLabel}</p>
          <div className="grid grid-cols-3 gap-3">
            <ThemeCard
              active={state.theme === "light"}
              label={labels.themeLight}
              onClick={() => apply({ ...state, theme: "light" })}
              variant="light"
            />
            <ThemeCard
              active={state.theme === "dark"}
              label={labels.themeDark}
              onClick={() => apply({ ...state, theme: "dark" })}
              variant="dark"
            />
            <ThemeCard
              active={state.theme === "system"}
              label={labels.themeSystem}
              onClick={() => apply({ ...state, theme: "system" })}
              variant="system"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Font Size ── */}
      <Card className="overflow-hidden border-ink/8">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">{labels.fontSizeLabel}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FontSizeCard
              active={state.fontSize === "small"}
              label={labels.fontSizeSmall}
              sample="あ"
              sizeClass="text-base"
              onClick={() => apply({ ...state, fontSize: "small" })}
            />
            <FontSizeCard
              active={state.fontSize === "default"}
              label={labels.fontSizeDefault}
              sample="あ"
              sizeClass="text-lg"
              onClick={() => apply({ ...state, fontSize: "default" })}
            />
            <FontSizeCard
              active={state.fontSize === "large"}
              label={labels.fontSizeLarge}
              sample="あ"
              sizeClass="text-2xl"
              onClick={() => apply({ ...state, fontSize: "large" })}
            />
            <FontSizeCard
              active={state.fontSize === "xl"}
              label={labels.fontSizeXl}
              sample="あ"
              sizeClass="text-3xl"
              onClick={() => apply({ ...state, fontSize: "xl" })}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Density ── */}
      <Card className="overflow-hidden border-ink/8">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">{labels.densityLabel}</p>
          <div className="grid grid-cols-2 gap-3">
            <DensityCard
              active={state.density === "compact"}
              label={labels.densityCompact}
              onClick={() => apply({ ...state, density: "compact" })}
              variant="compact"
            />
            <DensityCard
              active={state.density === "comfortable"}
              label={labels.densityComfortable}
              onClick={() => apply({ ...state, density: "comfortable" })}
              variant="comfortable"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Live Preview ── */}
      <Card className="overflow-hidden border-ink/8">
        <CardContent className="space-y-3 p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">{labels.preview}</p>
          <div className="rounded-xl border border-ink/6 bg-paper/50 p-4">
            <p
              className={`leading-[1.8] text-ink ${fontSizeMap[state.fontSize] ?? "text-base"}`}
              lang="ja"
            >
              {labels.previewText}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Status ── */}
      <div className="flex items-center gap-3">
        {saving && (
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" />
            Saving…
          </span>
        )}
        {saved && !saving && (
          <span className="text-xs font-medium text-leaf" role="status">
            ✓ {labels.saved}
          </span>
        )}
      </div>

      {/* Back link */}
      <Link
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
        href={`/${locale}/settings`}
      >
        ← {labels.title}
      </Link>
    </main>
  );
}

/* ── Theme Preview Card ── */

function ThemeCard({
  active,
  label,
  onClick,
  variant,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  variant: "light" | "dark" | "system";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col items-center gap-2 rounded-2xl border-2 p-3 transition-all duration-200 active:scale-[0.97] ${
        active
          ? "border-accent bg-accent/5 shadow-md shadow-accent/10"
          : "border-ink/8 bg-surface hover:border-ink/15 hover:shadow-sm"
      }`}
    >
      {/* Mini mockup */}
      <div className="relative h-16 w-full overflow-hidden rounded-lg">
        {variant === "light" && (
          <div className="absolute inset-0 bg-gradient-to-br from-white to-gray-100 border border-gray-200 rounded-lg">
            <div className="m-2 h-2 w-8 rounded bg-gray-300" />
            <div className="mx-2 mt-1 h-1.5 w-12 rounded bg-gray-200" />
            <div className="absolute bottom-2 left-2 right-2 flex gap-1">
              <div className="h-3 flex-1 rounded bg-blue-100" />
              <div className="h-3 flex-1 rounded bg-gray-100" />
            </div>
          </div>
        )}
        {variant === "dark" && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-lg">
            <div className="m-2 h-2 w-8 rounded bg-gray-600" />
            <div className="mx-2 mt-1 h-1.5 w-12 rounded bg-gray-700" />
            <div className="absolute bottom-2 left-2 right-2 flex gap-1">
              <div className="h-3 flex-1 rounded bg-blue-900/50" />
              <div className="h-3 flex-1 rounded bg-gray-700" />
            </div>
          </div>
        )}
        {variant === "system" && (
          <div className="absolute inset-0 flex rounded-lg overflow-hidden">
            <div className="w-1/2 bg-gradient-to-b from-white to-gray-100 border-r border-gray-200">
              <div className="m-1.5 h-1.5 w-5 rounded bg-gray-300" />
              <div className="mx-1.5 mt-0.5 h-1 w-7 rounded bg-gray-200" />
            </div>
            <div className="w-1/2 bg-gradient-to-b from-gray-900 to-gray-800">
              <div className="m-1.5 h-1.5 w-5 rounded bg-gray-600" />
              <div className="mx-1.5 mt-0.5 h-1 w-7 rounded bg-gray-700" />
            </div>
          </div>
        )}
      </div>
      <span className={`text-xs font-semibold ${active ? "text-accent" : "text-ink"}`}>{label}</span>
      {/* Active indicator */}
      {active && (
        <div className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-accent text-white shadow-sm">
          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}

/* ── Font Size Card ── */

function FontSizeCard({
  active,
  label,
  sample,
  sizeClass,
  onClick,
}: {
  active: boolean;
  label: string;
  sample: string;
  sizeClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-4 transition-all duration-200 active:scale-[0.97] ${
        active
          ? "border-accent bg-accent/5 shadow-md shadow-accent/10"
          : "border-ink/8 bg-surface hover:border-ink/15 hover:shadow-sm"
      }`}
    >
      <span className={`font-bold text-ink leading-none ${sizeClass}`} lang="ja">{sample}</span>
      <span className={`text-[10px] font-semibold ${active ? "text-accent" : "text-muted"}`}>{label}</span>
      {active && (
        <div className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-accent text-white">
          <svg className="size-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}

/* ── Density Card ── */

function DensityCard({
  active,
  label,
  onClick,
  variant,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  variant: "compact" | "comfortable";
}) {
  const gap = variant === "compact" ? "gap-0.5" : "gap-1.5";
  const barH = variant === "compact" ? "h-1.5" : "h-2.5";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col items-center gap-2 rounded-2xl border-2 px-4 py-4 transition-all duration-200 active:scale-[0.97] ${
        active
          ? "border-accent bg-accent/5 shadow-md shadow-accent/10"
          : "border-ink/8 bg-surface hover:border-ink/15 hover:shadow-sm"
      }`}
    >
      {/* Mini line preview */}
      <div className={`flex w-full flex-col ${gap}`}>
        <div className={`${barH} w-full rounded bg-ink/15`} />
        <div className={`${barH} w-3/4 rounded bg-ink/10`} />
        <div className={`${barH} w-5/6 rounded bg-ink/15`} />
        <div className={`${barH} w-2/3 rounded bg-ink/10`} />
      </div>
      <span className={`text-xs font-semibold ${active ? "text-accent" : "text-ink"}`}>{label}</span>
      {active && (
        <div className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-accent text-white">
          <svg className="size-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
}
