"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";
import { useSharePostcard } from "../../../_hooks/use-share-postcard";

interface DayReward {
  day: number;
  type: string;
  value: string;
  label: string;
  claimed: boolean;
  current: boolean;
  isBigReward: boolean;
}

interface BonusStatus {
  chainDay: number;
  canClaim: boolean;
  rewards: DayReward[];
}

interface ClaimResult {
  alreadyClaimed: boolean;
  claimed: boolean;
  chainDay: number;
  reward?: { type: string; value: string; label: string };
}

export function LoginBonusWidget({ locale }: { locale: string }) {
  const { userId } = useKeycloakAuth();
  const [status, setStatus] = useState<BonusStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState<ClaimResult | null>(null);
  const { share, sharing } = useSharePostcard();

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await learnerApiFetch("/api/gamification/login-bonus");
      if (r.ok) setStatus((await r.json()) as BonusStatus);
    } catch { /* no-op */ } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const claim = useCallback(async () => {
    if (!userId || claiming) return;
    setClaiming(true);
    try {
      const r = await learnerApiFetch("/api/gamification/login-bonus/claim", {
        method: "POST",
      });
      if (r.ok) {
        const result = (await r.json()) as ClaimResult;
        setJustClaimed(result);
        // Refresh after claim
        setTimeout(() => void load(), 1500);
      }
    } catch { /* no-op */ } finally {
      setClaiming(false);
    }
  }, [userId, claiming, load]);

  if (!userId || loading) {
    if (loading) {
      return (
        <div className="rounded-2xl border border-ink/8 bg-surface p-4 shadow-sm animate-pulse">
          <div className="h-4 w-28 rounded bg-ink/10" />
          <div className="mt-3 flex gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-12 w-12 rounded-xl bg-ink/5" />
            ))}
          </div>
        </div>
      );
    }
    return null;
  }

  if (!status) return null;

  // Just claimed animation
  if (justClaimed?.claimed && justClaimed.reward) {
    return (
      <div className="rounded-2xl border border-[var(--color-matcha)]/30 bg-[var(--color-matcha)]/5 p-5 shadow-sm text-center">
        <div className="text-3xl animate-bounce">🎁</div>
        <p className="mt-2 text-sm font-bold text-ink">Nhận thưởng ngày {justClaimed.chainDay}!</p>
        <p className="mt-1 text-lg font-black text-[var(--color-matcha)]">{justClaimed.reward.label}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink/8 bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">🎁 Thưởng hàng ngày</h3>
        {status.canClaim && (
          <button
            disabled={claiming}
            onClick={() => void claim()}
            className="inline-flex min-h-8 items-center rounded-lg bg-accent px-3 text-xs font-bold text-white transition hover:opacity-90 active:scale-[0.95] disabled:opacity-50"
          >
            {claiming ? "…" : "Nhận"}
          </button>
        )}
      </div>

      {/* 7-day chain */}
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {status.rewards.map((r) => (
          <div
            key={r.day}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border p-2 min-w-[3rem] transition-all",
              r.claimed
                ? "border-[var(--color-matcha)]/30 bg-[var(--color-matcha)]/10"
                : r.current
                  ? "border-accent/40 bg-accent/5 ring-2 ring-accent/20"
                  : "border-ink/6 bg-paper",
              r.isBigReward && !r.claimed && "border-amber-400/40 bg-amber-50"
            )}
          >
            <span className="text-[10px] font-semibold text-muted">D{r.day}</span>
            <span className="text-base">
              {r.claimed ? "✅" : r.isBigReward ? "🌟" : r.type === "freeze" ? "🧊" : "💎"}
            </span>
            <span className="text-[9px] text-muted whitespace-nowrap">{r.label}</span>
          </div>
        ))}
      </div>

      {/* Share button for 7+ day streaks */}
      {status.chainDay >= 7 && (
        <button
          onClick={() => void share("/api/learner/shares/streak", { streakDays: status.chainDay })}
          disabled={sharing}
          className="mt-2 w-full rounded-lg bg-ink/5 py-1.5 text-[10px] font-medium text-muted hover:bg-ink/10 transition-colors"
        >
          {sharing ? "Đang tạo..." : "📤 Chia sẻ streak"}
        </button>
      )}
    </div>
  );
}
