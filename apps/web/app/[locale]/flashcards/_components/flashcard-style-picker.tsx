"use client";

import {
  flashcardThemeConfigSchema,
  type FlashcardThemeConfig,
  type FlashcardThemeTier
} from "@nihongo-bjt/shared";
import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { learnerApiFetch } from "../../../../lib/learner-api";
import { flashcardThemeCss } from "./flashcard-theme-css";

export interface FlashcardStyleOption {
  config: FlashcardThemeConfig;
  descriptionKey: string | null;
  id: string;
  locked: boolean;
  nameKey: string;
  slug: string;
  tier: FlashcardThemeTier;
}

export interface StylePickerLabels {
  styleDescriptions: Record<string, string>;
  styleNames: Record<string, string>;
  stylePickerActive: string;
  stylePickerApplied: string;
  stylePickerApplyError: string;
  stylePickerApplying: string;
  stylePickerClose: string;
  stylePickerDescription: string;
  stylePickerEmpty: string;
  stylePickerExclusive: string;
  stylePickerFree: string;
  stylePickerLoadError: string;
  stylePickerLocked: string;
  stylePickerPremium: string;
  stylePickerPreviewLabel: string;
  stylePickerRetry: string;
  stylePickerScrollHint: string;
  stylePickerSelectTheme: string;
  stylePickerTitle: string;
  stylePickerUnnamed: string;
}

function parseStyles(input: unknown): FlashcardStyleOption[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const value = candidate as Record<string, unknown>;
    const config = flashcardThemeConfigSchema.safeParse(value.config);
    if (
      !config.success ||
      typeof value.id !== "string" ||
      typeof value.slug !== "string" ||
      typeof value.nameKey !== "string" ||
      !["free", "premium", "exclusive"].includes(String(value.tier))
    ) {
      return [];
    }
    return [
      {
        config: config.data,
        descriptionKey: typeof value.descriptionKey === "string" ? value.descriptionKey : null,
        id: value.id,
        locked: value.locked === true,
        nameKey: value.nameKey,
        slug: value.slug,
        tier: value.tier as FlashcardThemeTier
      }
    ];
  });
}

export function FlashcardStyleGrid({
  activeSlug,
  applyingSlug,
  labels,
  onSelect,
  styles
}: {
  activeSlug: string | null;
  applyingSlug: string | null;
  labels: StylePickerLabels;
  onSelect: (style: FlashcardStyleOption) => void;
  styles: FlashcardStyleOption[];
}) {
  const activeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (
      !activeButtonRef.current ||
      typeof window.matchMedia !== "function" ||
      !window.matchMedia("(max-width: 639px)").matches
    ) {
      return;
    }
    activeButtonRef.current.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeSlug, styles]);

  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-muted sm:hidden">
        {labels.stylePickerScrollHint}
      </p>
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
        {styles.map((style) => {
          const isActive = style.slug === activeSlug;
          const isPending = applyingSlug === style.slug;
          const name = labels.styleNames[style.slug] ?? labels.stylePickerUnnamed;
          const description = labels.styleDescriptions[style.slug];
          const tierLabel =
            style.tier === "free"
              ? labels.stylePickerFree
              : style.tier === "premium"
                ? labels.stylePickerPremium
                : labels.stylePickerExclusive;

          return (
            <button
              aria-busy={isPending || undefined}
              aria-label={labels.stylePickerSelectTheme.replace("{name}", name)}
              aria-pressed={isActive}
              className={cn(
                "group relative min-h-44 w-[11rem] shrink-0 snap-start rounded-2xl border-2 p-3 text-left outline-none transition-[border-color,box-shadow,transform] sm:w-auto",
                "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0",
                "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                isActive
                  ? "border-accent bg-accent/5 shadow-md ring-1 ring-accent/25"
                  : style.locked
                    ? "border-ink/10 bg-ink/[0.03]"
                    : "border-ink/10 bg-surface hover:border-ink/25 hover:shadow-md",
                isPending && "pointer-events-none opacity-60"
              )}
              disabled={isPending || style.locked}
              key={style.id}
              onClick={() => onSelect(style)}
              ref={isActive ? activeButtonRef : undefined}
              type="button"
            >
              <div
                aria-label={`${labels.stylePickerPreviewLabel}: ${name}`}
                className="flashcard-theme-surface flex h-24 w-full items-center justify-center overflow-hidden rounded-xl border p-2"
                role="img"
                style={flashcardThemeCss(style.config)}
              >
                <div className="flashcard-theme-content flex w-full flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center">
                  <span className="text-2xl font-bold text-[var(--flashcard-foreground)]" lang="ja">
                    勉強
                  </span>
                  <span className="text-xs text-[var(--flashcard-muted-foreground)]" lang="ja">
                    べんきょう
                  </span>
                  <span
                    aria-hidden
                    className="mt-1 h-0.5 w-7 rounded-full bg-[var(--flashcard-accent)]"
                  />
                </div>
              </div>

              <span className="mt-2.5 flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-tight text-ink">{name}</span>
                  {description ? (
                    <span className="mt-1 block text-xs leading-snug text-muted">
                      {description}
                    </span>
                  ) : null}
                </span>
                {isActive ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-1 text-[10px] font-black text-white">
                    <span aria-hidden>✓</span>
                    {labels.stylePickerActive}
                  </span>
                ) : null}
              </span>

              <span className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                  {tierLabel}
                </span>
                {style.locked ? (
                  <span className="rounded-full bg-ink px-2 py-1 text-[10px] font-bold text-surface">
                    <span aria-hidden>🔒 </span>
                    {labels.stylePickerLocked}
                  </span>
                ) : isPending ? (
                  <span className="text-[10px] font-bold text-accent">
                    {labels.stylePickerApplying}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FlashcardStylePickerModal({
  labels,
  onClose,
  onStyleApplied,
  open
}: {
  labels: StylePickerLabels;
  onClose: () => void;
  onStyleApplied?: (config: FlashcardThemeConfig) => void;
  open: boolean;
}) {
  const [styles, setStyles] = useState<FlashcardStyleOption[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchStyles = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await learnerApiFetch("/api/flashcards/styles");
      if (!response.ok) throw new Error("styles_load_failed");
      const data = (await response.json()) as { activeSlug?: unknown; styles?: unknown };
      const parsedStyles = parseStyles(data.styles);
      setStyles(parsedStyles);
      setActiveSlug(typeof data.activeSlug === "string" ? data.activeSlug : null);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    void fetchStyles();
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [fetchStyles, onClose, open]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  async function applyStyle(style: FlashcardStyleOption) {
    if (style.slug === activeSlug) return;
    setApplying(style.slug);
    try {
      const response = await learnerApiFetch("/api/flashcards/styles/active", {
        body: JSON.stringify({ slug: style.slug }),
        headers: { "Content-Type": "application/json" },
        method: "PUT"
      });
      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as { code?: string } | null;
        showToast(
          error?.code === "ENTITLEMENT_DENIED"
            ? labels.stylePickerLocked
            : labels.stylePickerApplyError
        );
        return;
      }
      setActiveSlug(style.slug);
      showToast(labels.stylePickerApplied);
      onStyleApplied?.(style.config);
    } catch {
      showToast(labels.stylePickerApplyError);
    } finally {
      setApplying(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-3xl sm:p-6"
        role="dialog"
      >
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-ink" id={titleId}>
              {labels.stylePickerTitle}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted" id={descriptionId}>
              {labels.stylePickerDescription}
            </p>
          </div>
          <button
            aria-label={labels.stylePickerClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-ink/5 text-ink outline-none transition-colors hover:bg-ink/10 focus-visible:ring-2 focus-visible:ring-accent"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <span aria-hidden>✕</span>
          </button>
        </header>

        {loading ? (
          <div
            aria-busy="true"
            aria-label={labels.stylePickerApplying}
            className="flex gap-3 overflow-hidden sm:grid sm:grid-cols-2"
          >
            {Array.from({ length: 4 }, (_, index) => (
              <div
                className="h-44 w-[11rem] shrink-0 animate-pulse rounded-2xl bg-ink/[0.08] sm:w-auto"
                key={index}
              />
            ))}
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-danger/25 bg-danger-soft p-5 text-center">
            <p className="text-sm font-semibold text-ink">{labels.stylePickerLoadError}</p>
            <button
              className="mt-3 min-h-11 rounded-xl bg-ink px-5 text-sm font-bold text-surface outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => void fetchStyles()}
              type="button"
            >
              {labels.stylePickerRetry}
            </button>
          </div>
        ) : styles.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink/15 px-5 py-8 text-center text-sm text-muted">
            {labels.stylePickerEmpty}
          </p>
        ) : (
          <FlashcardStyleGrid
            activeSlug={activeSlug}
            applyingSlug={applying}
            labels={labels}
            onSelect={(style) => void applyStyle(style)}
            styles={styles}
          />
        )}

        {toast ? (
          <div
            aria-live="polite"
            className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-[60] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-center text-sm font-semibold text-surface shadow-xl"
            role="status"
          >
            {toast}
          </div>
        ) : null}
      </section>
    </div>
  );
}
