"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useRef, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type AutofillFormType =
  | "battle-bot"
  | "battle-config"
  | "mock-exam"
  | "quiz-template"
  | "remediation"
  | "question-bank"
  | "growth-social"
  | "growth-postcard"
  | "daily-hub"
  | "daily-radar-module"
  | "daily-radar-card";

export type AutofillMode = "template" | "ai";

interface Props {
  /** Which form schema to generate data for */
  formType: AutofillFormType;
  /** Callback with generated field values */
  onFill: (fields: Record<string, unknown>) => void;
  /** Optional extra context sent to the API */
  context?: Record<string, unknown>;
  /** Locale for content generation */
  locale?: string;
  /** Custom label overrides */
  labels?: {
    button?: string;
    template?: string;
    ai?: string;
    loading?: string;
    error?: string;
  };
  /** Disable the button */
  disabled?: boolean;
  /** Extra className for the wrapper */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function AdminAutoFill({
  formType,
  onFill,
  context,
  locale = "vi",
  labels,
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const generate = useCallback(
    async (mode: AutofillMode) => {
      setOpen(false);
      setError(null);
      setLoading(true);
      try {
        const res = await adminApiFetch("/api/admin/autofill/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ formType, mode, locale, context }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError((body as { message?: string }).message ?? "Auto-fill failed");
          return;
        }
        const data = (await res.json()) as { fields: Record<string, unknown> };
        onFill(data.fields);
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    },
    [formType, locale, context, onFill]
  );

  // Close dropdown when clicking outside
  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (!menuRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  }, []);

  const btnLabel = labels?.button ?? "Auto Fill";
  const templateLabel = labels?.template ?? "📋 Template";
  const aiLabel = labels?.ai ?? "✨ AI Generate";
  const loadingLabel = labels?.loading ?? "Generating...";

  return (
    <div
      className={cn("relative inline-block", className)}
      onBlur={handleBlur}
      ref={menuRef}
    >
      <button
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium shadow-sm transition",
          "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100",
          "focus:outline-none focus:ring-2 focus:ring-violet-300",
          (disabled || loading) && "cursor-not-allowed opacity-50"
        )}
        disabled={disabled || loading}
        onClick={() => setOpen((p) => !p)}
        type="button"
      >
        {loading ? (
          <>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
            {loadingLabel}
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {btnLabel}
            <svg className={cn("h-3 w-3 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-violet-50 hover:text-violet-700"
            onClick={() => void generate("template")}
            type="button"
          >
            {templateLabel}
            <span className="ml-auto text-[10px] text-slate-400">random</span>
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-violet-50 hover:text-violet-700"
            onClick={() => void generate("ai")}
            type="button"
          >
            {aiLabel}
            <span className="ml-auto text-[10px] text-slate-400">smart</span>
          </button>
        </div>
      )}

      {error && (
        <p className="mt-1 text-[10px] text-red-500">{labels?.error ?? error}</p>
      )}
    </div>
  );
}
