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
        "inline-flex max-w-full items-center rounded-lg border border-ink/10 bg-paper/90 px-2.5 py-0.5 text-xs font-medium tracking-tight text-ink",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
