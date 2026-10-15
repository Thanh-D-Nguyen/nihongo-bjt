"use client";

interface ActivityHeatmapProps {
  /** Dense daily data for the selected period, sorted by date ascending */
  dailyStats: Array<{
    date: string;
    minutes: number;
    xpEarned: number;
    lessonsCount: number;
  }>;
  label: string;
  minuteLabel: string;
}

/**
 * GitHub-style heatmap showing daily learning intensity.
 * Colors range from no activity (gray) to high intensity (deep emerald).
 */
export function ActivityHeatmap({ dailyStats, label, minuteLabel }: ActivityHeatmapProps) {
  // Build activity map
  const activityMap = new Map<string, number>();
  let maxActivity = 1;
  for (const d of dailyStats) {
    activityMap.set(d.date, d.minutes);
    if (d.minutes > maxActivity) maxActivity = d.minutes;
  }

  const days = dailyStats.map((day) => ({
    dateStr: day.date,
    intensity: (activityMap.get(day.date) ?? 0) / maxActivity
  }));

  // Group into weeks (columns)
  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-muted">{label}</p>
      <div className="overflow-x-auto rounded-lg bg-surface/50 p-3 dark:bg-gray-800/30">
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day) => (
                <div
                  key={day.dateStr}
                  className={`h-3 w-3 rounded-[3px] transition-colors ${intensityClass(day.intensity)}`}
                  role="img"
                  aria-label={`${day.dateStr}: ${Math.round(day.intensity * maxActivity)} ${minuteLabel}`}
                  title={`${day.dateStr}: ${Math.round(day.intensity * maxActivity)} ${minuteLabel}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function intensityClass(intensity: number): string {
  if (intensity === 0) return "bg-gray-100 dark:bg-gray-700";
  if (intensity < 0.25) return "bg-emerald-200 dark:bg-emerald-800/60";
  if (intensity < 0.5) return "bg-emerald-400 dark:bg-emerald-600/70";
  if (intensity < 0.75) return "bg-emerald-500 dark:bg-emerald-500/80 shadow-sm shadow-emerald-200 dark:shadow-emerald-900";
  return "bg-emerald-600 dark:bg-emerald-400 shadow-sm shadow-emerald-200 dark:shadow-emerald-800";
}
