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
        "flex flex-col items-center justify-center rounded-[14px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-6 py-10 text-center",
        className
      )}
      {...props}
    >
      <p className="text-sm font-semibold text-[#111827]">{title}</p>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[#4B5563]">{description}</p>
      ) : null}
      {children}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
