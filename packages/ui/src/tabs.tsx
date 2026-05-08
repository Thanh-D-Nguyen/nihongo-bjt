import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

import { cn } from "./cn";

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("inline-flex gap-1 rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] p-1", className)}
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
        "min-h-9 rounded-[8px] px-3 text-xs font-semibold outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-blue-500/30",
        active ? "bg-white text-[#111827] shadow-sm" : "text-[#4B5563] hover:bg-white/70 hover:text-[#111827]",
        className
      )}
      role="tab"
      type="button"
      {...props}
    />
  );
}
