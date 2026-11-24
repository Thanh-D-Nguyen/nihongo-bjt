"use client";

import { cn } from "@nihongo-bjt/ui";

export function StudyFocusToggle({
  focused,
  label,
  onToggle,
  variant = "surface"
}: {
  focused: boolean;
  label: string;
  onToggle: () => void;
  variant?: "surface" | "overlay";
}) {
  const styles =
    variant === "overlay"
      ? focused
        ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
        : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"
      : focused
        ? "border-accent bg-accent-soft text-brand-accent"
        : "border-border bg-surface text-muted hover:border-ink/25 hover:text-ink";

  return (
    <button
      aria-checked={focused}
      className={cn(
        "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
        styles
      )}
      onClick={onToggle}
      role="switch"
      type="button"
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block h-2 w-2 rounded-full transition-colors",
          variant === "overlay"
            ? focused
              ? "bg-emerald-300"
              : "bg-white/40"
            : focused
              ? "bg-brand-accent"
              : "bg-muted/50"
        )}
      />
      <span>{label}</span>
    </button>
  );
}
