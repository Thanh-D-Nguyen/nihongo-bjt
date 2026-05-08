import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { cn } from "./cn";

export function AdminDataTable({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full border-collapse text-left text-sm text-[#111827]", className)}
      {...props}
    />
  );
}

export function AdminDataTableHead({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn(className)} {...props} />;
}

export function AdminDataTableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn(className)} {...props} />;
}

export function AdminDataTableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn(className)} {...props} />;
}

export function AdminDataTableTh({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#4B5563]",
        className
      )}
      {...props}
    />
  );
}

export function AdminDataTableTd({
  className,
  muted,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { muted?: boolean }) {
  return (
    <td
      className={cn(
        "border-b border-[#E2E8F0] px-3 py-2.5",
        muted ? "text-[#4B5563]" : "text-[#111827]",
        className
      )}
      {...props}
    />
  );
}

export function AdminDataTableCellActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}
