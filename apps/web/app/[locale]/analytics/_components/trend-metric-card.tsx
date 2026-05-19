"use client";

interface TrendMetricCardProps {
  label: string;
  value: number | string;
  previousValue?: number | null;
  icon: React.ReactNode;
  accentClass?: string;
}

/**
 * Bento metric card with gradient accent, icon, and trend arrow.
 */
export function TrendMetricCard({
  label,
  value,
  previousValue,
  icon,
  accentClass = "from-accent/10 to-accent/5 dark:from-accent/20 dark:to-accent/10"
}: TrendMetricCardProps) {
  const trend = computeTrend(value, previousValue);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-ink/8 bg-gradient-to-br ${accentClass} p-4 shadow-sm transition-shadow hover:shadow-md dark:border-ink/15`}
    >
      <div className="flex items-start justify-between">
        <div className="flex size-9 items-center justify-center rounded-xl bg-white/60 text-lg shadow-sm dark:bg-gray-800/60">
          {icon}
        </div>
        {trend && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              trend.direction === "up"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : trend.direction === "down"
                  ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
                  : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}
            {trend.percent}%
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-muted">{label}</p>
    </div>
  );
}

function computeTrend(
  current: number | string,
  previous?: number | null
): { direction: "up" | "down" | "flat"; percent: number } | null {
  if (previous == null || previous === 0) return null;
  const curr = typeof current === "string" ? parseFloat(current) : current;
  if (isNaN(curr)) return null;
  const diff = curr - previous;
  const pct = Math.round(Math.abs(diff / previous) * 100);
  if (pct === 0) return { direction: "flat", percent: 0 };
  return { direction: diff > 0 ? "up" : "down", percent: pct };
}
