import type { HTMLAttributes } from "react";

import { cn } from "./cn";

export function ProgressBar({
  className,
  value,
  ...props
}: HTMLAttributes<HTMLDivElement> & { value: number }) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(clamped)}
      className={cn("h-2 overflow-hidden rounded-full bg-ink/8", className)}
      role="progressbar"
      {...props}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-300"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
