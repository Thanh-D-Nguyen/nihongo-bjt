"use client";

import { useState } from "react";

interface ActivityBarChartProps {
  data: Array<{
    date: string;
    lessonsCount: number;
    minutes: number;
    xpEarned: number;
  }>;
  labels: {
    lessons: string;
    minutes: string;
    xp: string;
  };
}

/**
 * Daily study minutes with a hover tooltip for the API's other study stats.
 */
export function ActivityBarChart({ data, labels }: ActivityBarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((p) => p.minutes));

  // For mobile: show max ~14 bars with labels, rest just bars
  const showLabels = data.length <= 14;

  return (
    <div className="relative">
      {/* Tooltip */}
      {hovered !== null && data[hovered] && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-lg border border-ink/10 bg-surface px-3 py-2 text-xs shadow-lg dark:border-ink/20 dark:bg-gray-800"
          style={{
            left: `${((hovered + 0.5) / data.length) * 100}%`,
            transform: "translateX(-50%) translateY(-100%)"
          }}
        >
          <p className="font-bold text-ink tabular-nums">{data[hovered].date}</p>
          <div className="mt-1 space-y-0.5">
            <p className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-sm bg-emerald-500" />
              <span className="text-muted">{labels.minutes}:</span>
              <span className="font-semibold text-ink">{data[hovered].minutes}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-sm bg-accent" />
              <span className="text-muted">{labels.xp}:</span>
              <span className="font-semibold text-ink">{data[hovered].xpEarned}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-sm bg-amber-500" />
              <span className="text-muted">{labels.lessons}:</span>
              <span className="font-semibold text-ink">{data[hovered].lessonsCount}</span>
            </p>
          </div>
        </div>
      )}

      {/* Bars */}
      <div
        className="flex h-36 items-end gap-[2px] sm:gap-1"
        role="img"
        aria-label={labels.minutes}
      >
        {data.map((p, i) => {
          const total = p.minutes;
          const heightPct = Math.max(total === 0 ? 0 : 3, (total / max) * 100);

          return (
            <div
              key={p.date}
              className="group relative flex min-w-0 flex-1 flex-col items-center justify-end"
              style={{ height: "100%" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onTouchStart={() => setHovered(i)}
            >
              <div
                className="w-full max-w-[18px] origin-bottom animate-[bar-grow-up_0.6s_ease-out_both] overflow-hidden rounded-t-md transition-all duration-300 sm:max-w-[22px]"
                style={{
                  height: `${heightPct}%`,
                  animationDelay: `${i * 20}ms`
                }}
              >
                <div
                  className={`h-full w-full ${total === 0 ? "bg-ink/5 dark:bg-ink/10" : "bg-emerald-500/85 dark:bg-emerald-400/80"}`}
                />
              </div>

              {/* Date label (only for small data sets) */}
              {showLabels && (
                <span className="mt-1 max-w-full truncate text-[8px] font-medium text-muted tabular-nums sm:text-[10px]">
                  {p.date.slice(5)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted sm:text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-emerald-500/85" />
          {labels.minutes}
        </span>
      </div>
    </div>
  );
}
