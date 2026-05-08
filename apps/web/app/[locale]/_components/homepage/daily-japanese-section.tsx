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

const kindColors: Record<string, string> = {
  weather: "from-sky-400 to-blue-500",
  business_phrase: "from-amber-400 to-orange-500",
  seasonal_word: "from-pink-400 to-rose-500",
  time_greeting: "from-emerald-400 to-teal-500",
};

function DailyCard({ widget, locale }: { widget: DailyWidget; locale: string }) {
  const item = widget.item;
  if (!item) return null;

  const icon = kindIcons[widget.config.widgetKind] ?? "📝";
  const gradient = kindColors[widget.config.widgetKind] ?? "from-slate-400 to-slate-500";

  return (
    <Link
      href={`/${locale}/daily/${item.id}`}
      className="group flex w-[260px] shrink-0 flex-col overflow-hidden rounded-[14px] bg-white shadow-sm ring-1 ring-[#E2E8F0] transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 sm:w-[280px]"
    >
      {/* Colored top accent strip */}
      <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
      
      <div className="flex flex-col p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-medium text-[#4B5563] uppercase tracking-wider">
            {widget.config.widgetKind.replace(/_/g, " ")}
          </span>
        </div>

        <h3 className="text-sm font-semibold text-[#111827] line-clamp-1">{item.title}</h3>

        {item.japaneseText && (
          <p className="mt-2 text-lg font-medium leading-relaxed text-[#1B2A4A]" lang="ja">
            {item.japaneseText}
          </p>
        )}

        {item.readingText && (
          <p className="mt-0.5 text-xs text-[#6B7280]" lang="ja">
            {item.readingText}
          </p>
        )}

        {item.explanationText && (
          <p className="mt-2 text-xs leading-relaxed text-[#4B5563] line-clamp-2">
            {item.explanationText}
          </p>
        )}
      </div>
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
            <h2 className="text-lg font-bold text-[#111827] sm:text-xl">{labels.dailyTitle}</h2>
            <p className="text-sm text-[#4B5563]">{labels.dailySubtitle}</p>
          </div>
        </div>
        <div className="flex gap-3 overflow-hidden pb-1">
          {[1, 2, 3].map((i) => (
            <div
              className="h-48 w-[260px] shrink-0 animate-pulse rounded-[14px] bg-slate-100 ring-1 ring-[#E2E8F0] sm:w-[280px]"
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
          <h2 className="text-lg font-bold text-[#111827] sm:text-xl">{labels.dailyTitle}</h2>
          <p className="text-sm text-[#4B5563]">{labels.dailySubtitle}</p>
        </div>
        <Link
          href={`/${locale}#daily-japanese`}
          className="hidden text-sm font-medium text-[#3B82F6] hover:text-[#2563EB] sm:block"
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
