import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type SectionHeaderProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  /** Primary label for the section (not a marketing hero). */
  title: ReactNode;
  description?: ReactNode;
  /** Small uppercase kicker above the title (dashboard sections). */
  eyebrow?: string;
  actions?: ReactNode;
  /** Semantic heading level for the title. */
  heading?: "h2" | "h3";
  /** Set on the heading for `aria-labelledby` on a parent `<section>`. */
  id?: string;
  /**
   * `default` — eyebrow + title + optional description.
   * `overline` — single muted uppercase line (KPI / dense admin blocks).
   */
  variant?: "default" | "overline";
};

/**
 * Consistent section chrome for dashboards and dense pages.
 * Pair with `<section aria-labelledby={id}>` when `id` is set.
 */
export function SectionHeader({
  title,
  description,
  eyebrow,
  actions,
  heading: Heading = "h2",
  className,
  id,
  variant = "default",
  ...props
}: SectionHeaderProps) {
  if (variant === "overline") {
    return (
      <header className={cn("mb-3 sm:mb-4", className)} {...props}>
        <Heading className="text-xs font-semibold uppercase tracking-wide text-[#4B5563]" id={id}>
          {title}
        </Heading>
      </header>
    );
  }

  return (
    <header
      className={cn(
        "mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4",
        className
      )}
      {...props}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
            {eyebrow}
          </p>
        ) : null}
        <Heading className="text-base font-semibold tracking-tight text-[#111827] md:text-[17px]" id={id}>
          {title}
        </Heading>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-[#4B5563]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
