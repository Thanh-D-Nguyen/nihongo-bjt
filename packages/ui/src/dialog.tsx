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
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
      {...props}
    >
      <div
        className={cn(
          "w-full max-w-md rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-xl",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
