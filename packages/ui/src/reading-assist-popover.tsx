import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

/**
 * Presentational panel for reading-assist tooltips / bottom sheets (subtle, not noisy).
 */
export function ReadingAssistPopoverPanel({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-ink/10 bg-surface px-3 py-2 text-sm text-ink shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
