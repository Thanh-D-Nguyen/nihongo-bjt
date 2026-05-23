"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";

interface HeatmapDay {
  date: string;
  reviews: number;
  quizzes: number;
  focusMinutes: number;
  total: number;
  level: 0 | 1 | 2 | 3 | 4;
}

interface HeatmapData {
  days: HeatmapDay[];
  totalDaysActive: number;
  longestStreak: number;
  currentStreak: number;
}

const LEVEL_COLORS = [
  "bg-ink/5",
  "bg-[var(--color-matcha)]/20",
  "bg-[var(--color-matcha)]/40",
  "bg-[var(--color-matcha)]/60",
  "bg-[var(--color-matcha)]",
];

const MONTHS = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
const TOOLTIP_WIDTH = 180;
const TOOLTIP_HEIGHT = 68;
const TOOLTIP_GAP = 10;

function heatmapTooltipPosition(rect: DOMRect) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const preferredLeft = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
  const left = Math.max(8, Math.min(preferredLeft, viewportWidth - TOOLTIP_WIDTH - 8));
  const preferredTop = rect.top - TOOLTIP_HEIGHT - TOOLTIP_GAP;
  const top =
    preferredTop >= 8
      ? preferredTop
      : Math.min(rect.bottom + TOOLTIP_GAP, viewportHeight - TOOLTIP_HEIGHT - 8);

  return { left, top };
}

export function LearningHeatmap({ locale }: { locale: string }) {
  const { userId } = useKeycloakAuth();
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ day: HeatmapDay; x: number; y: number } | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await learnerApiFetch("/api/analytics/heatmap?days=365");
      if (r.ok) setData(await r.json());
    } catch { /* no-op */ } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  if (!userId) return null;

  if (loading) {
    return (
      <div className="rounded-2xl border border-ink/8 bg-surface p-4 shadow-sm animate-pulse">
        <div className="h-4 w-32 rounded bg-ink/10" />
        <div className="mt-4 h-[100px] rounded bg-ink/5" />
      </div>
    );
  }

  if (!data || data.days.length === 0) return null;

  // Build grid: 7 rows × N weeks
  // Pad start to align with weekday
  const firstDay = new Date(data.days[0].date);
  const startDow = firstDay.getDay(); // 0=Sun
  const padded: (HeatmapDay | null)[] = Array(startDow).fill(null).concat(data.days);
  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }
  // Pad last week
  while (weeks.length > 0 && weeks[weeks.length - 1].length < 7) {
    weeks[weeks.length - 1].push(null);
  }

  // Month labels
  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks.length; w++) {
    const firstValid = weeks[w].find((d) => d !== null);
    if (firstValid) {
      const m = new Date(firstValid.date).getMonth();
      if (m !== lastMonth) {
        monthLabels.push({ label: MONTHS[m], col: w });
        lastMonth = m;
      }
    }
  }

  return (
    <div className="rounded-2xl border border-ink/8 bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-ink">🟩 Lịch học tập</h3>
        <div className="flex gap-3 text-[10px] text-muted">
          <span>🔥 {data.currentStreak} ngày liên tiếp</span>
          <span>📅 {data.totalDaysActive} ngày</span>
        </div>
      </div>

      {/* Stats pills */}
      <div className="flex gap-2 mb-3">
        <span className="rounded-full bg-[var(--color-matcha)]/10 px-2.5 py-1 text-[10px] font-bold text-[var(--color-matcha)]">
          Streak dài nhất: {data.longestStreak}
        </span>
        <span className="rounded-full bg-ink/5 px-2.5 py-1 text-[10px] font-bold text-muted">
          Tổng: {data.totalDaysActive}/{data.days.length} ngày
        </span>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto pb-1 -mx-1 px-1" onMouseLeave={() => setTooltip(null)}>
        {/* Month labels */}
        <div className="flex mb-1 ml-5" style={{ gap: 0 }}>
          {monthLabels.map((m, i) => (
            <div
              key={i}
              className="text-[9px] text-muted"
              style={{ position: "relative", left: `${m.col * 13}px` }}
            >
              {m.label}
            </div>
          ))}
        </div>

        <div className="flex gap-[1px]">
          {/* Day labels */}
          <div className="flex flex-col gap-[1px] mr-1 pt-0">
            {["", "T2", "", "T4", "", "T6", ""].map((l, i) => (
              <div key={i} className="h-[11px] text-[8px] text-muted leading-[11px] w-4 text-right">
                {l}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[1px]">
              {week.map((day, di) => (
                <div
                  key={di}
                  className={cn(
                    "h-[11px] w-[11px] rounded-[2px] transition-colors",
                    day ? LEVEL_COLORS[day.level] : "bg-transparent",
                    day && day.level > 0 && "cursor-pointer",
                  )}
                  onMouseEnter={(e) => {
                    if (!day) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pos = heatmapTooltipPosition(rect);
                    setTooltip({ day, x: pos.left, y: pos.top });
                  }}
                  onFocus={(e) => {
                    if (!day) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pos = heatmapTooltipPosition(rect);
                    setTooltip({ day, x: pos.left, y: pos.top });
                  }}
                  onBlur={() => setTooltip(null)}
                  tabIndex={day ? 0 : undefined}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-1 mt-2">
          <span className="text-[9px] text-muted mr-1">Ít</span>
          {LEVEL_COLORS.map((c, i) => (
            <div key={i} className={cn("h-[10px] w-[10px] rounded-[2px]", c)} />
          ))}
          <span className="text-[9px] text-muted ml-1">Nhiều</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[9999] rounded-lg bg-[#1E293B] px-3 py-2 text-[10px] text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
              role="tooltip"
              style={{ left: tooltip.x, top: tooltip.y, width: TOOLTIP_WIDTH }}
            >
              <div className="font-bold">{tooltip.day.date}</div>
              <div>Ôn tập: {tooltip.day.reviews} · Quiz: {tooltip.day.quizzes}</div>
              {tooltip.day.focusMinutes > 0 && <div>Focus: {tooltip.day.focusMinutes} phút</div>}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
