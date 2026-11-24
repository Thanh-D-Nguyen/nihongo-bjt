"use client";

import { cn } from "@nihongo-bjt/ui";
import Link from "next/link";

import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";

export interface StudyTrackTabsLabels {
  ariaLabel: string;
  levelsTab: string;
  scenariosTab: string;
  readingTab: string;
}

export type StudyTrackKey = "levels" | "scenarios" | "reading";

export function StudyTrackTabs({
  activeTrack,
  className,
  labels,
  locale
}: {
  activeTrack: StudyTrackKey;
  className?: string;
  labels?: StudyTrackTabsLabels;
  locale: string;
}) {
  const fallbackMessages = locale === "ja" ? ja : locale === "en" ? en : vi;
  const resolvedLabels = labels ?? fallbackMessages.studyTracks;
  const tabs: Array<{ href: string; key: StudyTrackKey; label: string }> = [
    { href: `/${locale}/levels`, key: "levels", label: resolvedLabels.levelsTab },
    { href: `/${locale}/scenarios`, key: "scenarios", label: resolvedLabels.scenariosTab },
    { href: `/${locale}/news`, key: "reading", label: resolvedLabels.readingTab }
  ];

  return (
    <nav
      aria-label={resolvedLabels.ariaLabel}
      className={cn("flex flex-wrap items-center gap-3", className)}
    >
      <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-surface p-1 ring-1 ring-border">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTrack;
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
    </nav>
  );
}
