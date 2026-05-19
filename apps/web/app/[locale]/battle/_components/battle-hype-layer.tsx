"use client";

import { useEffect, useState, type CSSProperties } from "react";

/* ─── Hype Commentary — shows exciting text for streaks, close scores, etc. ─── */

const HYPE_MESSAGES_STREAK = [
  "🔥 Unstoppable!",
  "⚡ On Fire!",
  "💥 Combo Master!",
  "🎯 Perfect Flow!",
  "✨ Incredible!",
];

const HYPE_MESSAGES_CLOSE_SCORE = [
  "⚔️ Neck and neck!",
  "😰 So close!",
  "🏁 Anyone's game!",
];

const HYPE_MESSAGES_COMEBACK = [
  "🔄 Comeback time!",
  "💪 Never give up!",
  "🚀 Turning the tide!",
];

const HYPE_MESSAGES_DOMINATING = [
  "👑 Dominating!",
  "🏆 Crushing it!",
  "⭐ Flawless!",
];

type HypeLayerProps = {
  combo: number;
  userScore: number;
  opponentScore: number;
  roundIndex: number | null;
  totalRounds: number | null;
  lastAnswerCorrect: boolean | null;
};

export function BattleHypeLayer({
  combo,
  userScore,
  opponentScore,
  roundIndex,
  totalRounds,
  lastAnswerCorrect,
}: HypeLayerProps) {
  const [hypeText, setHypeText] = useState<string | null>(null);
  const [hypeKey, setHypeKey] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (lastAnswerCorrect === null) return;

    let msg: string | null = null;

    // Streak hype
    if (combo >= 3 && lastAnswerCorrect) {
      msg = HYPE_MESSAGES_STREAK[Math.min(combo - 3, HYPE_MESSAGES_STREAK.length - 1)];
    }
    // Close score in late rounds
    else if (
      roundIndex !== null &&
      totalRounds !== null &&
      roundIndex >= totalRounds * 0.6 &&
      Math.abs(userScore - opponentScore) <= 1
    ) {
      msg = HYPE_MESSAGES_CLOSE_SCORE[Math.floor(Math.random() * HYPE_MESSAGES_CLOSE_SCORE.length)];
    }
    // Comeback scenario
    else if (lastAnswerCorrect && userScore < opponentScore && combo >= 2) {
      msg = HYPE_MESSAGES_COMEBACK[Math.floor(Math.random() * HYPE_MESSAGES_COMEBACK.length)];
    }
    // Dominating
    else if (lastAnswerCorrect && userScore >= opponentScore + 3) {
      msg = HYPE_MESSAGES_DOMINATING[Math.floor(Math.random() * HYPE_MESSAGES_DOMINATING.length)];
    }

    if (!msg) return;

    setExiting(false);
    setHypeText(msg);
    setHypeKey((k) => k + 1);

    const exitTimer = window.setTimeout(() => setExiting(true), 1800);
    const clearTimer = window.setTimeout(() => setHypeText(null), 2100);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(clearTimer);
    };
  }, [combo, userScore, opponentScore, roundIndex, totalRounds, lastAnswerCorrect]);

  if (!hypeText) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center"
    >
      <span
        className={`inline-block rounded-full border border-amber-200/60 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-2 text-sm font-black tracking-wide text-amber-800 shadow-lg shadow-amber-500/10 ${
          exiting ? "battle-hype-text-exit" : "battle-hype-text"
        }`}
        key={hypeKey}
      >
        {hypeText}
      </span>
    </div>
  );
}

/* ─── Solo Victory Confetti — celebratory particles for bot wins ─── */

const CONFETTI_COLORS = [
  "#fbbf24", "#f472b6", "#34d399", "#60a5fa", "#a78bfa",
  "#fb923c", "#f43f5e", "#2dd4bf", "#818cf8", "#fcd34d",
];

type ConfettiProps = {
  active: boolean;
};

export function BattleVictoryConfetti({ active }: ConfettiProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (!active || reducedMotion) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-2xl"
    >
      {Array.from({ length: 40 }).map((_, i) => {
        const left = `${5 + Math.random() * 90}%`;
        const startY = `${-10 - Math.random() * 20}px`;
        const endY = `${100 + Math.random() * 60}px`;
        const driftX = `${(Math.random() - 0.5) * 80}px`;
        const spin = `${360 + Math.random() * 720}deg`;
        const delay = `${Math.random() * 0.8}s`;
        const duration = `${1.4 + Math.random() * 1.2}s`;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const size = 4 + Math.random() * 6;
        const isRect = i % 3 === 0;
        return (
          <span
            className="battle-confetti-piece absolute"
            key={i}
            style={
              {
                "--start-y": startY,
                "--end-y": endY,
                "--drift-x": driftX,
                "--spin": spin,
                "--delay": delay,
                "--fall-duration": duration,
                left,
                top: 0,
                width: `${size}px`,
                height: isRect ? `${size * 2.5}px` : `${size}px`,
                backgroundColor: color,
                borderRadius: isRect ? "2px" : "50%",
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/* ─── Combo Indicator — visual escalation for streaks ─── */

type ComboIndicatorProps = {
  combo: number;
};

export function BattleComboIndicator({ combo }: ComboIndicatorProps) {
  if (combo < 2) return null;

  const level = combo >= 5 ? "blaze" : combo >= 3 ? "fire" : "warm";
  const cls =
    level === "blaze"
      ? "battle-combo-blaze"
      : level === "fire"
        ? "battle-combo-fire"
        : "";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black tabular-nums ${
        level === "blaze"
          ? "border-red-300/50 bg-red-50/80 text-red-600"
          : level === "fire"
            ? "border-amber-300/50 bg-amber-50/80 text-amber-600"
            : "border-orange-200/50 bg-orange-50/60 text-orange-600"
      } ${cls}`}
    >
      {level === "blaze" ? "🔥🔥" : level === "fire" ? "🔥" : "⚡"}
      ×{combo}
    </span>
  );
}
