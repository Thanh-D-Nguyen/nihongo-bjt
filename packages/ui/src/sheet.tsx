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
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" aria-hidden />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[14px] border border-[#E2E8F0] bg-white shadow-xl",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
