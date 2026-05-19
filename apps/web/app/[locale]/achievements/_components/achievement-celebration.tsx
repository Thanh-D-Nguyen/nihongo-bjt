"use client";

import { useEffect, useState } from "react";

interface CelebrationProps {
  show: boolean;
  achievementName: string;
  tier: string;
  onDismiss: () => void;
  labels: { celebration: string; celebrationCta: string };
}

const TIER_EMOJIS: Record<string, string> = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💎"
};

export function AchievementCelebration({ show, achievementName, tier, onDismiss, labels }: CelebrationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [show, onDismiss]);

  if (!visible) return null;

  // Respect prefers-reduced-motion
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-label={labels.celebration}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" />

      {/* Confetti particles */}
      {!prefersReduced && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="ann-confetti-piece absolute"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                backgroundColor: ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"][i % 6]
              }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div
        className={`relative z-10 mx-4 flex max-w-sm flex-col items-center rounded-3xl bg-white p-8 shadow-2xl dark:bg-gray-900 ${
          prefersReduced ? "" : "animate-in zoom-in-95 duration-500"
        }`}
      >
        <div className={`mb-4 text-6xl ${prefersReduced ? "" : "animate-bounce"}`}>
          {TIER_EMOJIS[tier] ?? "🏆"}
        </div>
        <h2 className="text-center text-xl font-bold text-ink">
          {labels.celebration}
        </h2>
        <p className="mt-2 text-center text-sm text-ink/70">
          {achievementName}
        </p>
        <div className="mt-2 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
          {tier}
        </div>
        <button
          className="mt-6 min-h-[48px] rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-white transition-transform active:scale-95"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        >
          {labels.celebrationCta}
        </button>
      </div>
    </div>
  );
}
