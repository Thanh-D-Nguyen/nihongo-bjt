"use client";

import { useEffect, useState, type CSSProperties } from "react";

type BattlePvpOutcomeEffectsProps = {
  fireworks: boolean;
};

export function BattlePvpOutcomeEffects({ fireworks }: BattlePvpOutcomeEffectsProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (!fireworks || reducedMotion) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-2xl"
    >
      {Array.from({ length: 26 }).map((_, i) => {
        const angle = (i / 26) * Math.PI * 2;
        const dist = 72 + (i % 6) * 16;
        const tx = `${Math.round(Math.cos(angle) * dist)}px`;
        const ty = `${Math.round(Math.sin(angle) * dist)}px`;
        const bg =
          i % 3 === 0 ? "#fbbf24" : i % 3 === 1 ? "#f472b6" : "var(--color-leaf, #16a34a)";
        return (
          <span
            className="battle-firework-particle absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
            key={i}
            style={
              {
                "--tx": tx,
                "--ty": ty,
                animationDelay: `${(i % 10) * 0.075}s`,
                backgroundColor: bg
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
