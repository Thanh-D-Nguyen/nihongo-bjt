import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

import { cn } from "./cn";

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("inline-flex gap-1 rounded-xl border border-ink/10 bg-paper/80 p-1", className)}
      role="tablist"
      {...props}
    />
  );
}

export function TabButton({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      aria-selected={active}
      className={cn(
        "min-h-9 rounded-lg px-3 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-accent/35",
        active ? "bg-surface text-ink shadow-sm" : "text-muted hover:bg-surface/70 hover:text-ink",
        className
      )}
      role="tab"
      type="button"
      {...props}
    />
  );
}
