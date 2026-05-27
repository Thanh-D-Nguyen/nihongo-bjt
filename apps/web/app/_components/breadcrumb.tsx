"use client";

import Link from "next/link";
import { cn } from "@nihongo-bjt/ui";

export type BreadcrumbItem = {
  href?: string;
  label: string;
};

export function Breadcrumb({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (items.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "hidden items-center gap-1.5 text-sm text-muted lg:flex",
        className
      )}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="inline-flex items-center gap-1.5">
            {i > 0 && (
              <svg
                aria-hidden
                className="size-3.5 shrink-0 text-muted/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.25 4.5l7.5 7.5-7.5 7.5"
                />
              </svg>
            )}
            {isLast || !item.href ? (
              <span className="font-medium text-ink">{item.label}</span>
            ) : (
              <Link
                className="rounded-md px-1 py-0.5 transition-colors hover:bg-ink/5 hover:text-ink"
                href={item.href}
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
