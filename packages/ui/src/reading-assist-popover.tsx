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
        "rounded-[10px] border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#111827] shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
