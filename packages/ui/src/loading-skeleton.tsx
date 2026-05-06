import type { HTMLAttributes } from "react";

import { cn } from "./cn";

export function LoadingSkeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-ink/7 motion-reduce:animate-none", className)}
      {...props}
    />
  );
}
