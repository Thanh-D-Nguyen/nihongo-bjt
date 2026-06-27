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
        "rounded-[14px] border border-[#E2E8F0] bg-white px-4 py-3 text-sm leading-relaxed text-[#111827] shadow-[0_20px_25px_-5px_rgba(15,23,42,0.10),0_10px_10px_-5px_rgba(15,23,42,0.04)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
