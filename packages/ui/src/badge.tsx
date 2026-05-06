import type { HTMLAttributes } from "react";

import { cn } from "./cn";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "border-ink/10 bg-ink/5 text-muted",
  accent: "border-accent/15 bg-accent/8 text-accent",
  success: "border-leaf/20 bg-leaf/10 text-leaf",
  warning: "border-amber-300/40 bg-amber-100/70 text-amber-700",
  danger: "border-sakura/25 bg-sakura/10 text-sakura"
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full border px-2 text-[11px] font-semibold leading-none",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
