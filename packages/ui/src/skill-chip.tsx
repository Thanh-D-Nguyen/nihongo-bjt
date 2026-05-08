import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export function SkillChip({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-0.5 text-xs font-medium tracking-tight text-[#111827]",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
