import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type StatusBadgeVariant = "success" | "warning" | "neutral" | "danger";

const variants: Record<StatusBadgeVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  neutral: "border-[#E2E8F0] bg-[#F8FAFC] text-[#111827]",
  danger: "border-red-200 bg-red-50 text-red-800"
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
