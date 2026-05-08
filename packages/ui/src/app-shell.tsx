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
        "min-h-screen bg-[#F8FAFC]",
        className
      )}
      {...props}
    >
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-28 pt-0 sm:px-6 lg:px-8 lg:pb-16">
        {children}
      </div>
    </div>
  );
}
