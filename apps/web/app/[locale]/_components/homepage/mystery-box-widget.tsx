"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";

interface Reward {
  slug: string;
  nameVi: string;
  rewardType: string;
  rewardValue: number;
  rarity: string;
  iconEmoji: string;
  description?: string;
}

const RARITY_STYLES: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  common: { border: "border-ink/20", bg: "bg-ink/5", text: "text-muted", glow: "" },
  uncommon: { border: "border-[var(--color-matcha)]/30", bg: "bg-[var(--color-matcha)]/10", text: "text-[var(--color-matcha)]", glow: "shadow-[0_0_12px_var(--color-matcha)]" },
  rare: { border: "border-blue-400/30", bg: "bg-blue-400/10", text: "text-blue-500", glow: "shadow-[0_0_16px_rgba(59,130,246,0.4)]" },
  epic: { border: "border-purple-400/30", bg: "bg-purple-400/10", text: "text-purple-500", glow: "shadow-[0_0_20px_rgba(168,85,247,0.5)]" },
};

export function MysteryBoxWidget({ locale }: { locale: string }) {
  const { userId } = useKeycloakAuth();
  const [loading, setLoading] = useState(true);
  const [canOpen, setCanOpen] = useState(false);
  const [goalComplete, setGoalComplete] = useState(false);
  const [todayReward, setTodayReward] = useState<Reward | null>(null);
  const [opening, setOpening] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await learnerApiFetch("/api/gamification/mystery-box/status");
      if (r.ok) {
        const data = await r.json();
        setCanOpen(data.canOpen);
        setGoalComplete(data.goalComplete);
        if (data.todayReward) setTodayReward(data.todayReward);
      }
    } catch { /* no-op */ } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const handleOpen = async () => {
    if (opening) return;
    setOpening(true);
    try {
      const r = await learnerApiFetch("/api/gamification/mystery-box/open", { method: "POST" });
      if (r.ok) {
        const data = await r.json();
        // Wait for shake animation
        setTimeout(() => {
          setTodayReward(data.reward);
          setRevealed(true);
          setOpening(false);
          setCanOpen(false);
        }, 1500);
      } else {
        setOpening(false);
      }
    } catch {
      setOpening(false);
    }
  };

  if (!userId) return null;

  if (loading) {
    return (
      <div className="rounded-2xl border border-ink/8 bg-surface p-4 shadow-sm animate-pulse">
        <div className="h-4 w-28 rounded bg-ink/10" />
        <div className="mt-3 mx-auto h-16 w-16 rounded-xl bg-ink/5" />
      </div>
    );
  }

  const rarityStyle = RARITY_STYLES[todayReward?.rarity ?? "common"] ?? RARITY_STYLES.common;

  // Already claimed today — compact display
  if (todayReward && !revealed) {
    return (
      <div className={cn("rounded-2xl border p-4 shadow-sm", rarityStyle.border, rarityStyle.bg)}>
        <div className="flex items-center gap-2">
          <span className="text-lg">🎁</span>
          <h3 className="text-sm font-bold text-ink">Hộp quà hôm nay</h3>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-2xl">{todayReward.iconEmoji}</span>
          <div>
            <p className={cn("text-sm font-bold", rarityStyle.text)}>{todayReward.nameVi}</p>
            <p className="text-[10px] text-muted capitalize">{todayReward.rarity}</p>
          </div>
        </div>
      </div>
    );
  }

  // Revealed just now — celebration
  if (revealed && todayReward) {
    return (
      <div className={cn("rounded-2xl border p-4 shadow-sm text-center animate-in fade-in zoom-in-95 duration-500", rarityStyle.border, rarityStyle.bg, rarityStyle.glow)}>
        <div className="text-3xl animate-bounce">{todayReward.iconEmoji}</div>
        <p className={cn("mt-2 text-sm font-black", rarityStyle.text)}>{todayReward.nameVi}</p>
        <p className="mt-1 text-[10px] text-muted capitalize">{todayReward.rarity}</p>
        {todayReward.description && (
          <p className="mt-1 text-[10px] text-muted">{todayReward.description}</p>
        )}
        <button
          onClick={() => setRevealed(false)}
          className="mt-3 text-xs font-medium text-ink/50 underline"
        >
          OK
        </button>
      </div>
    );
  }

  // Goal not complete — locked
  if (!goalComplete) {
    return (
      <div className="rounded-2xl border border-ink/8 bg-surface p-4 shadow-sm opacity-60">
        <div className="flex items-center gap-2">
          <span className="text-lg grayscale">🎁</span>
          <h3 className="text-sm font-bold text-muted">Hộp quà bí ẩn</h3>
        </div>
        <p className="mt-2 text-xs text-muted text-center">
          🔒 Hoàn thành mục tiêu hôm nay để mở
        </p>
      </div>
    );
  }

  // Ready to open — animated
  return (
    <div className="rounded-2xl border border-[var(--color-gold,#f59e0b)]/30 bg-[var(--color-gold,#f59e0b)]/5 p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-lg">🎁</span>
        <h3 className="text-sm font-bold text-ink">Hộp quà bí ẩn</h3>
        <span className="ml-auto h-2 w-2 rounded-full bg-[var(--color-gold,#f59e0b)] animate-pulse" />
      </div>

      <div className="mt-3 flex justify-center">
        <div className={cn("text-4xl transition-transform", opening && "animate-[shake_0.5s_ease-in-out_infinite]")}>
          🎁
        </div>
      </div>

      <button
        onClick={() => void handleOpen()}
        disabled={opening}
        className={cn(
          "mt-3 w-full rounded-xl py-2.5 text-sm font-bold text-white shadow-sm transition-all",
          opening
            ? "bg-[var(--color-gold,#f59e0b)]/50 cursor-wait"
            : "bg-[var(--color-gold,#f59e0b)] active:scale-[0.97] hover:brightness-110",
        )}
      >
        {opening ? "Đang mở..." : "Mở hộp quà! ✨"}
      </button>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-4px) rotate(-5deg); }
          75% { transform: translateX(4px) rotate(5deg); }
        }
      `}</style>
    </div>
  );
}
