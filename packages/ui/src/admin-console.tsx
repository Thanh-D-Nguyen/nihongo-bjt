import type { HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

import { cn } from "./cn";

export function AdminPageHeader({
  actions,
  breadcrumbs,
  className,
  description,
  title,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className={cn("flex flex-col gap-4", className)} {...props}>
      {breadcrumbs ? <div className="text-xs font-medium text-slate-500">{breadcrumbs}</div> : null}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-950 md:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function AdminSection({
  actions,
  children,
  className,
  description,
  title,
  ...props
}: HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  description?: ReactNode;
  title?: ReactNode;
}) {
  return (
    <section className={cn("space-y-3", className)} {...props}>
      {title || description || actions ? (
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            {title ? <h2 className="text-sm font-semibold text-slate-950">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function AdminKpiCard({
  className,
  label,
  tone = "neutral",
  trend,
  value,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  tone?: "neutral" | "good" | "warning" | "danger";
  trend?: ReactNode;
  value: ReactNode;
}) {
  const tones = {
    danger: "border-red-200 bg-red-50/60",
    good: "border-emerald-200 bg-emerald-50/60",
    neutral: "border-slate-200 bg-white",
    warning: "border-amber-200 bg-amber-50/60"
  };
  return (
    <div className={cn("rounded-lg border p-4 shadow-sm", tones[tone], className)} {...props}>
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-950">
        {value}
      </p>
      {trend ? <div className="mt-2 text-xs font-medium text-slate-600">{trend}</div> : null}
    </div>
  );
}

export function AdminMetricTrend({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "up" | "down";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        tone === "up" && "bg-emerald-100 text-emerald-800",
        tone === "down" && "bg-red-100 text-red-800",
        tone === "neutral" && "bg-slate-100 text-slate-700"
      )}
    >
      {children}
    </span>
  );
}

export function AdminChartCard({
  children,
  className,
  description,
  title,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div
      className={cn("rounded-lg border border-slate-200 bg-white p-4 shadow-sm", className)}
      {...props}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function AdminFilterBar({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function AdminSearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="min-h-9 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 md:w-72"
      type="search"
      {...props}
    />
  );
}

export function AdminSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="min-h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
      {...props}
    />
  );
}

export function AdminStatusBadge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warning" | "danger";
}) {
  const tones = {
    danger: "border-red-200 bg-red-50 text-red-800",
    good: "border-emerald-200 bg-emerald-50 text-emerald-800",
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800"
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function AdminEmptyState({
  action,
  children,
  title
}: {
  action?: ReactNode;
  children?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      {children ? (
        <div className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{children}</div>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function AdminInsightCard({ children, title }: { children: ReactNode; title: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <div className="mt-2 text-sm leading-6 text-slate-600">{children}</div>
    </div>
  );
}

export function AdminTaskCard({
  action,
  children,
  title
}: {
  action?: ReactNode;
  children: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        {action}
      </div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{children}</div>
    </div>
  );
}
