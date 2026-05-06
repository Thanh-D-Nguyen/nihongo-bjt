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
        "min-h-screen bg-paper",
        className
      )}
      {...props}
    >
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-6 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}
