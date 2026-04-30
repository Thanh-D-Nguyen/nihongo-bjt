import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export function EmptyState({
  action,
  children,
  className,
  description,
  title,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  action?: ReactNode;
  description?: ReactNode;
  title: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink/15 bg-surface/60 px-6 py-10 text-center",
        className
      )}
      {...props}
    >
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{description}</p> : null}
      {children}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
