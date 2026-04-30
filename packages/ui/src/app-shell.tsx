import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export function AppShell({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={cn(
        "min-h-screen bg-paper bg-[radial-gradient(ellipse_at_top,_rgba(79,70,229,0.04),transparent_60%)]",
        className
      )}
      {...props}
    >
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-8 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}
