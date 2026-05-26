"use client";
 
import { cn } from "@nihongo-bjt/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";
 
interface RankState {
  rankXp: number;
  rankXpToNext: number;
  currentRankCode: string;
}
 
interface RankData {
  state: RankState;
  rank: { rankCode: string; displayOrder: number };
  nextRank: { rankCode: string } | null;
}
 
const RANK_DISPLAY: Record<string, { label: string; emoji: string }> = {
  R1: { label: "Thực tập sinh", emoji: "🌱" },
  R2: { label: "Nhân viên mới", emoji: "📋" },
  R3: { label: "Nhân viên", emoji: "💼" },
  R4: { label: "Trưởng nhóm", emoji: "⭐" },
  R5: { label: "Quản lý", emoji: "🏆" },
  R6: { label: "Giám đốc", emoji: "👑" },
};
 
export function XpRankWidget({ locale }: { locale: string }) {
  const { userId } = useKeycloakAuth();
  const [data, setData] = useState<RankData | null>(null);
  const [loading, setLoading] = useState(true);
 
  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await learnerApiFetch("/api/career/me");
      if (r.ok) setData(await r.json());
    } catch {
      /* no-op */
    } finally {
      setLoading(false);
    }
  }, [userId]);
 
  useEffect(() => {
    void load();
  }, [load]);
 
  if (!userId) return null;
 
  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#1B2A4A] to-[#312E81] p-4 shadow-lg animate-pulse">
        <div className="h-3 w-20 rounded bg-white/10" />
        <div className="mt-3 h-8 w-32 rounded bg-white/10" />
        <div className="mt-3 h-2 w-full rounded-full bg-white/10" />
      </div>
    );
  }
 
  if (!data) {
    return (
      <Link
        href={`/${locale}/career`}
        className="group block overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-4 shadow-sm transition-all hover:shadow-md hover:border-indigo-300"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <span className="text-sm font-bold text-indigo-900">Career XP</span>
        </div>
        <p className="mt-2 text-xs text-indigo-700/80">
          Bắt đầu Career RPG để tích lũy XP và thăng cấp!
        </p>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:text-indigo-800 transition-colors">
          Bắt đầu →
        </span>
      </Link>
    );
  }
 
  const { state, rank } = data;
  const nextRank = data.nextRank;
  const rankInfo = RANK_DISPLAY[rank.rankCode] ?? {
    label: rank.rankCode,
    emoji: "📊",
  };
  const nextRankInfo = nextRank ? (RANK_DISPLAY[nextRank.rankCode] ?? null) : null;
  const progress =
    state.rankXpToNext > 0
      ? Math.min(100, Math.round((state.rankXp / state.rankXpToNext) * 100))
      : 100;
  const remaining = Math.max(0, state.rankXpToNext - state.rankXp);
  const nearLevelUp = progress >= 80;
 
  return (
    <Link
      href={`/${locale}/career`}
      className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-[#1B2A4A] via-[#1E3A5F] to-[#312E81] p-4 shadow-lg transition-all hover:shadow-xl hover:scale-[1.01]"
    >
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-400/10 blur-2xl" />
      <div className="pointer-events-none absolute -left-4 -bottom-4 h-20 w-20 rounded-full bg-blue-400/10 blur-xl" />
 
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{rankInfo.emoji}</span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
              {rankInfo.label}
            </span>
          </div>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/50">
            Lv.{rank.displayOrder}
          </span>
        </div>
 
        {/* XP Display — large, prominent */}
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-black tabular-nums tracking-tight text-white">
            {state.rankXp.toLocaleString()}
          </span>
          <span className="text-sm font-medium text-white/40">
            / {state.rankXpToNext.toLocaleString()} XP
          </span>
        </div>
 
        {/* Progress bar */}
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                nearLevelUp
                  ? "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 animate-[shimmer_2s_ease-in-out_infinite]"
                  : "bg-gradient-to-r from-blue-400 to-indigo-400",
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/40">
            {nearLevelUp && nextRankInfo ? (
              <span className="font-bold text-amber-300 animate-pulse">
                Còn {remaining.toLocaleString()} XP → {nextRankInfo.emoji} {nextRankInfo.label}
              </span>
            ) : (
              <span>Còn {remaining.toLocaleString()} XP để thăng cấp</span>
            )}
          </div>
        </div>
 
        {/* Arrow hint */}
        <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-white/30 group-hover:text-white/60 transition-colors">
          <span>Xem chi tiết</span>
          <svg
            className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}