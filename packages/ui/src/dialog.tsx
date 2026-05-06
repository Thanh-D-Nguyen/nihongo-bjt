import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export function Dialog({
  children,
  className,
  open,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; open: boolean }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/35 p-4 backdrop-blur-[1px]"
      {...props}
    >
      <div
        className={cn(
          "w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-5 shadow-2xl",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
