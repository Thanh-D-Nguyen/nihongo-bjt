"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { cn } from "./cn";

export type HelpStep = {
  title: string;
  description: string;
};

export type HelpContent = {
  title: string;
  description: string;
  steps?: HelpStep[];
  tips?: string[];
  relatedLinks?: Array<{ label: string; href: string }>;
};

function HelpIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <circle cx={12} cy={12} r={10} />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
      <line x1={12} x2={12.01} y1={17} y2={17} strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ContextualHelpButton({
  content,
  locale,
  buttonLabel = "Hướng dẫn",
  className,
}: {
  content: HelpContent;
  locale?: string;
  buttonLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label={buttonLabel}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5",
          "text-xs font-medium text-slate-600 shadow-sm transition-all",
          "hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
          className
        )}
        onClick={() => setOpen(true)}
        type="button"
      >
        <HelpIcon className="h-3.5 w-3.5" />
        <span>{buttonLabel}</span>
      </button>

      {open ? (
        <ContextualHelpPanel content={content} locale={locale} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function ContextualHelpPanel({
  content,
  locale,
  onClose,
}: {
  content: HelpContent;
  locale?: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
      />

      {/* Panel - slide from right */}
      <div className="absolute inset-y-0 right-0 flex max-w-md w-full">
        <div className="relative w-full overflow-y-auto bg-white shadow-2xl border-l border-slate-200">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <HelpIcon className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold text-slate-900">{content.title}</h2>
            </div>
            <button
              aria-label="Đóng"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              onClick={onClose}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-6 px-5 py-5">
            {/* Description */}
            <p className="text-sm leading-relaxed text-slate-600">{content.description}</p>

            {/* Steps */}
            {content.steps && content.steps.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Hướng dẫn từng bước
                </h3>
                <ol className="space-y-3">
                  {content.steps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-600">
                        {i + 1}
                      </span>
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium text-slate-800">{step.title}</p>
                        <p className="text-xs leading-relaxed text-slate-500">{step.description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {/* Tips */}
            {content.tips && content.tips.length > 0 ? (
              <div className="space-y-2 rounded-lg border border-amber-100 bg-amber-50/50 p-4">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700">
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 2a6 6 0 00-6 6c0 2.22 1.21 4.16 3 5.19V15a1 1 0 001 1h4a1 1 0 001-1v-1.81c1.79-1.03 3-2.97 3-5.19a6 6 0 00-6-6zM8 17a1 1 0 001 1h2a1 1 0 001-1v-1H8v1z" />
                  </svg>
                  Mẹo hay
                </h3>
                <ul className="space-y-1.5">
                  {content.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-amber-800">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Related links */}
            {content.relatedLinks && content.relatedLinks.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Trang liên quan
                </h3>
                <div className="flex flex-wrap gap-2">
                  {content.relatedLinks.map((link, i) => (
                    <a
                      key={i}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                      href={locale ? `/${locale}${link.href}` : link.href}
                    >
                      {link.label}
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
