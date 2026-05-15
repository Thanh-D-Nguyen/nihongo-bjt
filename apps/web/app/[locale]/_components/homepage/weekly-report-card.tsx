"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";

interface WeeklyReport {
  totalReviews: number;
  accuracyPct: number;
  streakDays: number;
  quizSessions: number;
  newCardsLearned: number;
  weakSkills: string[];
  prevWeekReviews: number | null;
  prevWeekAccuracy: number | null;
  weekStart: string;
  weekEnd: string;
}

function TrendArrow({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null || previous === undefined) return null;
  const diff = current - previous;
  if (diff === 0) return <span className="text-muted text-[10px]">→</span>;
  return (
    <span className={cn("text-[10px] font-bold", diff > 0 ? "text-[var(--color-matcha)]" : "text-[var(--color-sakura)]")}>
      {diff > 0 ? "↑" : "↓"} {Math.abs(diff)}
    </span>
  );
}

export function WeeklyReportCard({ locale }: { locale: string }) {
  const { userId } = useKeycloakAuth();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await learnerApiFetch("/api/analytics/weekly-report/latest");
      if (r.ok) {
        const data = await r.json();
        if (data) setReport(data as WeeklyReport);
      }
    } catch { /* no-op */ } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  if (!userId) return null;

  if (loading) {
    return (
      <div className="rounded-2xl border border-ink/8 bg-surface p-4 shadow-sm animate-pulse">
        <div className="h-4 w-24 rounded bg-ink/10" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="h-14 rounded-xl bg-ink/5" />
          <div className="h-14 rounded-xl bg-ink/5" />
          <div className="h-14 rounded-xl bg-ink/5" />
          <div className="h-14 rounded-xl bg-ink/5" />
        </div>
      </div>
    );
  }

  if (!report) return null;

  const stats = [
    { label: "Ôn tập", value: report.totalReviews, prev: report.prevWeekReviews, emoji: "🃏" },
    { label: "Chính xác", value: `${report.accuracyPct}%`, prev: report.prevWeekAccuracy, unit: "%", emoji: "🎯" },
    { label: "Streak", value: report.streakDays, prev: null, unit: " ngày", emoji: "🔥" },
    { label: "Quiz", value: report.quizSessions, prev: null, emoji: "📝" },
  ];

  return (
    <div className="rounded-2xl border border-ink/8 bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">📊 Tuần này</h3>
        {report.weakSkills.length > 0 && (
          <span className="text-[10px] text-muted">
            Yếu: {report.weakSkills.slice(0, 2).join(", ")}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-ink/6 bg-paper p-3">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{s.emoji}</span>
              <span className="text-xs text-muted">{s.label}</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-black tabular-nums text-ink">{s.value}</span>
              {typeof s.prev === "number" && (
                <TrendArrow current={typeof s.value === "number" ? s.value : report.accuracyPct} previous={s.prev} />
              )}
            </div>
          </div>
        ))}
      </div>

      {report.newCardsLearned > 0 && (
        <p className="mt-3 text-xs text-muted text-center">
          +{report.newCardsLearned} thẻ mới trong tuần
        </p>
      )}
    </div>
  );
}
