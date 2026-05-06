"use client";

import Link from "next/link";
import { ScrollStrip } from "../../../_components/scroll-strip";
import type { DailyWidget, HomepageLabels } from "./types";

const kindIcons: Record<string, string> = {
  weather: "🌤",
  business_phrase: "💼",
  seasonal_word: "🌸",
  time_greeting: "⏰",
};

function DailyCard({ widget, locale }: { widget: DailyWidget; locale: string }) {
  const item = widget.item;
  if (!item) return null;

  const icon = kindIcons[widget.config.widgetKind] ?? "📝";

  return (
    <Link
      href={`/${locale}/daily/${item.id}`}
      className="group flex w-[260px] shrink-0 flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5 transition-all hover:shadow-md hover:-translate-y-0.5 sm:w-[280px]"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-muted uppercase tracking-wider">
          {widget.config.widgetKind.replace(/_/g, " ")}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-ink line-clamp-1">{item.title}</h3>

      {item.japaneseText && (
        <p className="mt-2 text-lg font-medium leading-relaxed text-ink/90" lang="ja">
          {item.japaneseText}
        </p>
      )}

      {item.readingText && (
        <p className="mt-0.5 text-xs text-muted" lang="ja">
          {item.readingText}
        </p>
      )}

      {item.explanationText && (
        <p className="mt-2 text-xs leading-relaxed text-muted line-clamp-2">
          {item.explanationText}
        </p>
      )}
    </Link>
  );
}

export function DailyJapaneseSection({
  hubReady,
  labels,
  locale,
  widgets,
}: {
  hubReady: boolean;
  labels: HomepageLabels;
  locale: string;
  widgets: DailyWidget[];
}) {
  const withContent = widgets.filter((w) => w.item !== null);

  if (!hubReady) {
    return (
      <section aria-busy id="daily-japanese">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink sm:text-xl">{labels.dailyTitle}</h2>
            <p className="text-sm text-muted">{labels.dailySubtitle}</p>
          </div>
        </div>
        <div className="flex gap-3 overflow-hidden pb-1">
          {[1, 2, 3].map((i) => (
            <div
              className="h-48 w-[260px] shrink-0 animate-pulse rounded-2xl bg-paper ring-1 ring-ink/5 sm:w-[280px]"
              key={i}
            />
          ))}
        </div>
        <p className="sr-only">{labels.sectionLoadingHint}</p>
      </section>
    );
  }

  if (withContent.length === 0) return null;

  return (
    <section id="daily-japanese">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink sm:text-xl">{labels.dailyTitle}</h2>
          <p className="text-sm text-muted">{labels.dailySubtitle}</p>
        </div>
        <Link
          href={`/${locale}#daily-japanese`}
          className="hidden text-sm font-medium text-emerald-600 hover:text-emerald-700 sm:block"
        >
          {labels.dailyViewAll}
        </Link>
      </div>

      <ScrollStrip>
        {withContent.map((w) => (
          <DailyCard key={w.config.id} widget={w} locale={locale} />
        ))}
      </ScrollStrip>
    </section>
  );
}
