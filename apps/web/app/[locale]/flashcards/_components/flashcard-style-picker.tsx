"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

import { learnerApiFetch } from "../../../../lib/learner-api";

/* ─── Types ─── */

interface FlashcardStyleOption {
  id: string;
  slug: string;
  nameKey: string;
  descriptionKey: string | null;
  config: Record<string, string>;
  tier: "free" | "premium" | "exclusive";
  locked: boolean;
}

export interface StylePickerLabels {
  stylePickerTitle: string;
  stylePickerDescription: string;
  stylePickerActive: string;
  stylePickerSelect: string;
  stylePickerPremium: string;
  stylePickerExclusive: string;
  stylePickerLocked: string;
  stylePickerFree: string;
  stylePickerApplied: string;
}

/* ─── Modal Component ─── */

export function FlashcardStylePickerModal({
  labels,
  onClose,
  onStyleApplied,
  open,
}: {
  labels: StylePickerLabels;
  onClose: () => void;
  onStyleApplied?: (config: Record<string, string>) => void;
  open: boolean;
}) {
  const [styles, setStyles] = useState<FlashcardStyleOption[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchStyles = useCallback(async () => {
    try {
      const res = await learnerApiFetch("/api/flashcards/styles");
      if (!res.ok) return;
      const data = await res.json();
      setStyles(data.styles ?? []);
      setActiveSlug(data.activeSlug ?? null);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchStyles();
  }, [open, fetchStyles]);

  async function applyStyle(slug: string) {
    setApplying(slug);
    try {
      const res = await learnerApiFetch("/api/flashcards/styles/active", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.message?.includes("entitlement")) {
          setToast(labels.stylePickerLocked);
        } else {
          setToast(err.message ?? "Failed");
        }
        setTimeout(() => setToast(null), 3000);
        return;
      }
      setActiveSlug(slug);
      setToast(labels.stylePickerApplied);
      setTimeout(() => setToast(null), 2500);
      const applied = styles.find((s) => s.slug === slug);
      if (applied && onStyleApplied) onStyleApplied(applied.config);
    } catch {
      setToast("Network error");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setApplying(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-surface p-5 sm:p-6 shadow-2xl max-h-[85vh] overflow-y-auto animate-[slideUp_250ms_ease-out] sm:animate-[scaleIn_200ms_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-black text-ink">{labels.stylePickerTitle}</h2>
            <p className="text-sm text-muted mt-0.5">{labels.stylePickerDescription}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-ink/60 transition-colors hover:bg-ink/10 hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* Loading skeleton */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-ink/8" />
            ))}
          </div>
        ) : styles.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No styles available</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {styles.map((style) => {
              const isActive = style.slug === activeSlug;
              const isLocked = style.locked;
              const isPending = applying === style.slug;

              return (
                <button
                  key={style.id}
                  type="button"
                  disabled={isPending || isActive || isLocked}
                  onClick={() => applyStyle(style.slug)}
                  className={cn(
                    "group relative flex flex-col items-center gap-3 rounded-2xl border-2 p-4 transition-all duration-200",
                    "hover:scale-[1.02] active:scale-[0.98]",
                    isActive
                      ? "border-accent bg-accent/5 shadow-lg shadow-accent/15 ring-2 ring-accent/20"
                      : isLocked
                        ? "border-ink/8 bg-ink/3 opacity-70"
                        : "border-ink/10 bg-surface hover:border-ink/25 hover:shadow-md",
                    isPending && "opacity-50 pointer-events-none"
                  )}
                >
                  {/* Preview card - larger */}
                  <div
                    className="flex h-28 w-full items-center justify-center rounded-xl transition-transform group-hover:scale-[1.02]"
                    style={{
                      background: style.config.cardBg ?? "#fff",
                      color: style.config.textColor ?? "#000",
                      borderRadius: style.config.borderRadius ?? "12px",
                      boxShadow: style.config.shadow ?? "0 4px 12px rgba(0,0,0,0.08)",
                      fontFamily: style.config.fontFamily ?? "sans-serif",
                    }}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-3xl font-bold">勉強</span>
                      <span className="text-xs opacity-60">べんきょう</span>
                      {style.config.accentColor && (
                        <div className="mt-1 h-0.5 w-6 rounded-full" style={{ background: style.config.accentColor }} />
                      )}
                    </div>
                  </div>

                  {/* Name */}
                  <span className="text-sm font-bold text-ink truncate w-full text-center">
                    {style.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>

                  {/* Tier badge */}
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wide",
                    style.tier === "free" ? "text-emerald-600" :
                    style.tier === "premium" ? "text-amber-600" : "text-purple-600"
                  )}>
                    {style.tier === "free" ? labels.stylePickerFree :
                     style.tier === "premium" ? `★ ${labels.stylePickerPremium}` :
                     `♛ ${labels.stylePickerExclusive}`}
                  </span>

                  {/* Active check badge */}
                  {isActive && (
                    <span className="absolute -top-2.5 -right-2.5 flex h-7 items-center rounded-full bg-accent px-2.5 text-xs font-bold text-white shadow-md">
                      ✓ {labels.stylePickerActive}
                    </span>
                  )}

                  {/* Locked overlay */}
                  {isLocked && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-ink/5">
                      <span className="rounded-full bg-ink/80 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-sm">
                        🔒 {labels.stylePickerLocked}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 animate-[fadeIn_200ms_ease-out] rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white shadow-xl">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
