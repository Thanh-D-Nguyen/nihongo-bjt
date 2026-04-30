import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type StatusBadgeVariant = "success" | "warning" | "neutral" | "danger";

const variants: Record<StatusBadgeVariant, string> = {
  success: "border-emerald-200/80 bg-emerald-50 text-emerald-950",
  warning: "border-indigo-200/80 bg-indigo-50 text-indigo-950",
  neutral: "border-ink/10 bg-paper text-ink",
  danger: "border-sakura/30 bg-sakura/10 text-ink"
};

export function StatusBadge({
  children,
  className,
  variant = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  variant?: StatusBadgeVariant;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
