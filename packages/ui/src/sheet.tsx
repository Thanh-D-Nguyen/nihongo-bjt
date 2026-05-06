import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export function Sheet({
  children,
  className,
  open,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; open: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" {...props}>
      <div className="absolute inset-0 bg-ink/35 backdrop-blur-[1px]" aria-hidden />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl border border-ink/10 bg-paper shadow-2xl",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
