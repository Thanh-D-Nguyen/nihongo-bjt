import type { HTMLAttributes } from "react";

import { cn } from "./cn";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "border-[#E2E8F0] bg-[#F1F5F9] text-[#4B5563]",
  accent: "border-blue-200 bg-blue-50 text-blue-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700"
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
