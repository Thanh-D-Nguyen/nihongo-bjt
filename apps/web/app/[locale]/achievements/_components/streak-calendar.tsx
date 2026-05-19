"use client";

interface StreakCalendarProps {
  lastActivityDate: string | null;
  currentStreak: number;
  label: string;
}

/**
 * GitHub-style contribution heatmap for last 12 weeks.
 * Shows which days user was active based on current streak count.
 */
export function StreakCalendar({ lastActivityDate, currentStreak, label }: StreakCalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build set of active dates (streak backward from lastActivityDate)
  const activeDates = new Set<string>();
  if (lastActivityDate && currentStreak > 0) {
    const lastDate = new Date(lastActivityDate);
    lastDate.setHours(0, 0, 0, 0);
    for (let i = 0; i < currentStreak; i++) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() - i);
      activeDates.add(d.toISOString().slice(0, 10));
    }
  }

  // Generate last 84 days (12 weeks)
  const days: { date: Date; dateStr: string; active: boolean }[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({ date: d, dateStr, active: activeDates.has(dateStr) });
  }

  // Group into weeks (columns)
  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium text-ink/50">{label}</p>
      <div className="overflow-x-auto rounded-lg bg-surface/50 p-3 dark:bg-gray-800/30">
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day) => (
                <div
                  key={day.dateStr}
                  className={`h-3 w-3 rounded-[3px] transition-colors ${
                    day.active
                      ? "bg-emerald-500 shadow-sm shadow-emerald-200 dark:shadow-emerald-800"
                      : "bg-gray-100 dark:bg-gray-700"
                  }`}
                  title={day.dateStr}
                  aria-label={`${day.dateStr}: ${day.active ? "active" : "inactive"}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
