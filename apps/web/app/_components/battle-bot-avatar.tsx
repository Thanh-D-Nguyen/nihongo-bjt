"use client";

import type { BattleBotAnimationState } from "@nihongo-bjt/shared";
import { Alignment, EventType, Fit, Layout, useRive } from "@rive-app/react-canvas";
import React, { useEffect, useMemo, useState } from "react";

export type BattleBotRiveMetadata = {
  artboard: string | null;
  src: string | null;
  stateMachine: string | null;
};

const moodStyle: Record<
  BattleBotAnimationState,
  {
    aura: string;
    badge: string;
    motion: string;
    ring: string;
  }
> = {
  abandoned: {
    aura: "bg-slate-300/55",
    badge: "bg-slate-600 text-white",
    motion: "scale-95 opacity-80",
    ring: "border-slate-300"
  },
  correct: {
    aura: "bg-leaf/25",
    badge: "bg-leaf text-white",
    motion: "-translate-y-1 scale-105",
    ring: "border-leaf/45"
  },
  countdown: {
    aura: "bg-amber/25",
    badge: "bg-amber text-white",
    motion: "scale-100",
    ring: "border-amber/45"
  },
  draw: {
    aura: "bg-accent/18",
    badge: "bg-accent text-white",
    motion: "scale-100",
    ring: "border-accent/30"
  },
  idle: {
    aura: "bg-accent/10",
    badge: "bg-surface text-muted",
    motion: "scale-100",
    ring: "border-ink/10"
  },
  lose: {
    aura: "bg-sakura/18",
    badge: "bg-sakura text-white",
    motion: "translate-y-1 scale-95",
    ring: "border-sakura/35"
  },
  matched: {
    aura: "bg-accent/20",
    badge: "bg-accent text-white",
    motion: "scale-105",
    ring: "border-accent/35"
  },
  thinking: {
    aura: "bg-indigo-400/20",
    badge: "bg-indigo-600 text-white",
    motion: "scale-100",
    ring: "border-indigo-300"
  },
  win: {
    aura: "bg-leaf/25",
    badge: "bg-leaf text-white",
    motion: "-translate-y-1 scale-110",
    ring: "border-leaf/45"
  },
  wrong: {
    aura: "bg-sakura/16",
    badge: "bg-sakura text-white",
    motion: "rotate-[-2deg] scale-95",
    ring: "border-sakura/35"
  }
};

function RiveBotCanvas({
  fallback,
  rive,
  state
}: {
  fallback: string;
  rive: BattleBotRiveMetadata;
  state: BattleBotAnimationState;
}) {
  const [failed, setFailed] = useState(false);
  const riveParams = useMemo(() => {
    const base = {
      autoplay: true,
      layout: new Layout({
        alignment: Alignment.Center,
        fit: Fit.Contain
      }),
      onLoadError: () => setFailed(true),
      src: rive.src ?? ""
    };
    return {
      ...base,
      ...(rive.artboard ? { artboard: rive.artboard } : {}),
      ...(rive.stateMachine ? { stateMachines: rive.stateMachine } : {})
    };
  }, [rive.artboard, rive.src, rive.stateMachine]);

  const { RiveComponent, rive: riveInstance } = useRive({
    ...riveParams,
    shouldDisableRiveListeners: true
  });

  useEffect(() => {
    setFailed(false);
  }, [rive.artboard, rive.src, rive.stateMachine]);

  useEffect(() => {
    if (!riveInstance || !rive.stateMachine) {
      return;
    }
    const stateMachine = rive.stateMachine;
    const fireConfiguredInput = () => {
      try {
        const inputs = riveInstance.stateMachineInputs(stateMachine);
        const input = inputs.find((item) => item.name === `battle_${state}`);
        if (!input) {
          return;
        }
        if (typeof input.fire === "function") {
          input.fire();
          return;
        }
        if ("value" in input) {
          input.value = true;
        }
      } catch {
        setFailed(true);
      }
    };
    fireConfiguredInput();
    riveInstance.on(EventType.Load, fireConfiguredInput);
    return () => {
      riveInstance.off(EventType.Load, fireConfiguredInput);
    };
  }, [rive.stateMachine, riveInstance, state]);

  if (!rive.src || failed) {
    return (
      <span className="grid h-full w-full place-items-center text-[clamp(1.25rem,8cqw,3rem)] font-black text-ink">
        {fallback}
      </span>
    );
  }

  return <RiveComponent aria-hidden className="h-full w-full" />;
}

class RiveBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Battle bot Rive render failed", error);
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function BattleBotAvatar({
  className = "",
  fallback,
  label,
  rive,
  showSignal = true,
  state,
  variant = "arena"
}: {
  className?: string;
  fallback: string;
  label?: string;
  rive: BattleBotRiveMetadata;
  showSignal?: boolean;
  state: BattleBotAnimationState;
  variant?: "arena" | "card" | "companion";
}) {
  const style = moodStyle[state];
  const fallbackNode = (
    <span className="grid h-full w-full place-items-center text-[clamp(1.25rem,8cqw,3rem)] font-black text-ink">
      {fallback}
    </span>
  );
  const pad = variant === "arena" ? "p-5" : variant === "companion" ? "p-0" : "p-2";
  const isCompanion = variant === "companion";

  return (
    <span
      aria-label={label}
      className={`relative grid aspect-square place-items-center overflow-hidden ${isCompanion ? "rounded-full" : `rounded-[1.65rem] border bg-white/82 shadow-sm ${style.ring}`} ${pad} ${className}`}
      role={label ? "img" : undefined}
      style={{ containerType: "inline-size" }}
    >
      <span
        aria-hidden
        className={`absolute inset-[12%] rounded-full blur-2xl transition-colors duration-300 ${style.aura}`}
      />
      <span
        className={`relative z-10 grid h-full w-full place-items-center transition-transform duration-300 ${style.motion}`}
      >
        {rive.src ? (
          <RiveBoundary fallback={fallbackNode}>
            <RiveBotCanvas fallback={fallback} rive={rive} state={state} />
          </RiveBoundary>
        ) : (
          fallbackNode
        )}
      </span>
      {showSignal ? (
        <span
          aria-hidden
          className={`absolute right-2 top-2 h-3 w-3 rounded-full border-2 border-white shadow-sm ${style.badge}`}
        />
      ) : null}
    </span>
  );
}
