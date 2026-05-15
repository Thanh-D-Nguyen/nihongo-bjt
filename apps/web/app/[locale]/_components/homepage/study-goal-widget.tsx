"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";

interface StudyTask {
  id: string;
  taskType: string;
  targetCount: number;
  doneCount: number;
  completedAt: string | null;
  sortOrder: number;
}

interface StudyPlan {
  planDate: string;
  targetMinutes: number;
  progressPct: number;
  isComplete: boolean;
  tasks: StudyTask[];
}

const GOAL_OPTIONS = [
  { minutes: 5, label: "5 phút", emoji: "🌱", desc: "Nhanh & nhẹ" },
  { minutes: 10, label: "10 phút", emoji: "📚", desc: "Cân bằng" },
  { minutes: 20, label: "20 phút", emoji: "🔥", desc: "Chuyên sâu" },
] as const;

const TASK_LABELS: Record<string, { label: string; emoji: string; href: string }> = {
  srs_review: { label: "Ôn thẻ SRS", emoji: "🃏", href: "/flashcards?tab=review" },
  bjt_quiz: { label: "Làm quiz BJT", emoji: "📝", href: "/quiz" },
  daily_phrase: { label: "Cụm từ hàng ngày", emoji: "💬", href: "/daily" },
  battle_bot: { label: "Đấu với Bot", emoji: "⚔️", href: "/battle" },
};

export function StudyGoalWidget({ locale }: { locale: string }) {
  const { userId } = useKeycloakAuth();
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [goalSet, setGoalSet] = useState<boolean | null>(null); // null = loading
  const [loading, setLoading] = useState(true);
  const [settingGoal, setSettingGoal] = useState(false);

  const loadPlan = useCallback(async () => {
    if (!userId) return;
    try {
      // Check if goal exists first
      const goalRes = await learnerApiFetch("/api/gamification/study-goal");
      if (!goalRes.ok || !(await goalRes.json())) {
        setGoalSet(false);
        setLoading(false);
        return;
      }
      setGoalSet(true);
      // Fetch today's plan
      const planRes = await learnerApiFetch("/api/gamification/study-plan/today");
      if (planRes.ok) {
        setPlan((await planRes.json()) as StudyPlan);
      }
    } catch {
      // silently fail, widget is non-critical
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  const pickGoal = useCallback(async (minutes: number) => {
    if (!userId) return;
    setSettingGoal(true);
    try {
      const r = await learnerApiFetch("/api/gamification/study-goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetMinutes: minutes }),
      });
      if (r.ok) {
        setGoalSet(true);
        // Fetch the auto-generated plan
        const planRes = await learnerApiFetch("/api/gamification/study-plan/today");
        if (planRes.ok) {
          setPlan((await planRes.json()) as StudyPlan);
        }
      }
    } catch {
      // no-op
    } finally {
      setSettingGoal(false);
    }
  }, [userId]);

  if (!userId) return null;

  // Loading skeleton
  if (loading) {
    return (
      <div className="rounded-2xl border border-ink/8 bg-surface p-5 shadow-sm animate-pulse">
        <div className="h-5 w-32 rounded bg-ink/10" />
        <div className="mt-4 h-3 w-full rounded-full bg-ink/10" />
        <div className="mt-4 space-y-2">
          <div className="h-10 rounded-xl bg-ink/5" />
          <div className="h-10 rounded-xl bg-ink/5" />
        </div>
      </div>
    );
  }

  // Goal picker (first time / no goal set)
  if (!goalSet) {
    return (
      <div className="rounded-2xl border border-ink/8 bg-surface p-5 shadow-sm">
        <h3 className="text-sm font-bold text-ink">🎯 Đặt mục tiêu hôm nay</h3>
        <p className="mt-1 text-xs text-muted">Chọn thời gian học mỗi ngày</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {GOAL_OPTIONS.map((opt) => (
            <button
              key={opt.minutes}
              disabled={settingGoal}
              onClick={() => void pickGoal(opt.minutes)}
              className="flex flex-col items-center gap-1 rounded-xl border border-ink/8 bg-paper p-3 text-center transition hover:border-accent/40 hover:bg-accent/5 active:scale-[0.97] disabled:opacity-50"
            >
              <span className="text-xl">{opt.emoji}</span>
              <span className="text-sm font-bold text-ink">{opt.label}</span>
              <span className="text-[10px] text-muted">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!plan) return null;

  // Progress ring calculation
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (plan.progressPct / 100) * circumference;

  return (
    <div className={cn(
      "rounded-2xl border bg-surface p-5 shadow-sm transition-all",
      plan.isComplete
        ? "border-[var(--color-matcha)]/30 bg-[var(--color-matcha)]/5"
        : "border-ink/8"
    )}>
      <div className="flex items-start gap-4">
        {/* Progress ring */}
        <div className="relative flex-shrink-0">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle
              cx="40" cy="40" r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-ink/8"
            />
            <circle
              cx="40" cy="40" r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={cn(
                "transition-all duration-700 ease-out",
                plan.isComplete ? "text-[var(--color-matcha)]" : "text-accent"
              )}
              transform="rotate(-90 40 40)"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-ink">
            {plan.progressPct}%
          </span>
        </div>

        {/* Goal info */}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-ink">
            {plan.isComplete ? "🎉 Hoàn thành!" : "🎯 Mục tiêu hôm nay"}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {plan.targetMinutes} phút · {plan.tasks.filter((t) => t.completedAt).length}/{plan.tasks.length} nhiệm vụ
          </p>
        </div>
      </div>

      {/* Task list */}
      <ul className="mt-4 space-y-2">
        {plan.tasks.map((task) => {
          const info = TASK_LABELS[task.taskType] ?? { label: task.taskType, emoji: "📌", href: "/" };
          const isDone = task.completedAt !== null;
          return (
            <li key={task.id}>
              <a
                href={`/${locale}${info.href}`}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-sm transition",
                  isDone
                    ? "border-[var(--color-matcha)]/20 bg-[var(--color-matcha)]/5 text-muted line-through"
                    : "border-ink/8 bg-paper text-ink hover:border-accent/30 hover:bg-accent/5 active:scale-[0.98]"
                )}
              >
                <span className="text-base">{isDone ? "✅" : info.emoji}</span>
                <span className="flex-1 font-medium">{info.label}</span>
                <span className="text-xs tabular-nums text-muted">
                  {task.doneCount}/{task.targetCount}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
