"use client";

import { cn } from "@nihongo-bjt/ui";
import Link from "next/link";

import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";

export interface PracticeModeTabsLabels {
  ariaLabel: string;
  battleLink: string;
  exercisesTab: string;
  quizTab: string;
}

export type PracticeModeKey = "quiz" | "exercises";

export function PracticeModeTabs({
  activeMode,
  className,
  labels,
  locale
}: {
  activeMode: PracticeModeKey;
  className?: string;
  labels?: PracticeModeTabsLabels;
  locale: string;
}) {
  const fallbackMessages = locale === "ja" ? ja : locale === "en" ? en : vi;
  const resolvedLabels = labels ?? fallbackMessages.practiceModes;
  const tabs: Array<{ href: string; key: PracticeModeKey; label: string }> = [
    { href: `/${locale}/quiz`, key: "quiz", label: resolvedLabels.quizTab },
    { href: `/${locale}/exercises`, key: "exercises", label: resolvedLabels.exercisesTab }
  ];

  return (
    <nav
      aria-label={resolvedLabels.ariaLabel}
      className={cn("flex flex-wrap items-center justify-between gap-3", className)}
    >
      <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-surface p-1 ring-1 ring-border">
        {tabs.map((tab) => {
          const isActive = tab.key === activeMode;
          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
                isActive
                  ? "bg-ink text-surface shadow-xs"
                  : "text-muted hover:bg-paper hover:text-ink"
              )}
              href={tab.href}
              key={tab.key}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <Link
        className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-xs font-semibold text-muted underline decoration-border underline-offset-4 transition-colors hover:text-ink hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus sm:text-sm"
        href={`/${locale}/battle`}
      >
        {resolvedLabels.battleLink}
      </Link>
    </nav>
  );
}
