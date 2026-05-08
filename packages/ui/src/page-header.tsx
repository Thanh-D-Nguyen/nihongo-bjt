import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export function PageHeader({
  actions,
  children,
  className,
  description,
  eyebrow,
  title,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-[#E2E8F0] pb-6 md:flex-row md:items-end md:justify-between",
        className
      )}
      {...props}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#3B82F6]">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-[#4B5563]">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
