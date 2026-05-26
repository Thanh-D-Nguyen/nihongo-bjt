"use client";

import { cn } from "./cn";

/**
 * Skip-link for keyboard/screen-reader users. Hidden until focused,
 * then appears as an overlay to skip repetitive navigation.
 *
 * Place as the first child of <body> or layout wrapper.
 *
 * Usage:
 *   <SkipLink targetId="main-content" />
 *   ...
 *   <main id="main-content" tabIndex={-1}>...</main>
 */
export function SkipLink({
  targetId = "main-content",
  label = "Skip to main content",
  className,
}: {
  targetId?: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        "fixed left-4 top-4 z-[9999] -translate-y-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform duration-200",
        "focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "sr-only focus:not-sr-only",
        className,
      )}
    >
      {label}
    </a>
  );
}
