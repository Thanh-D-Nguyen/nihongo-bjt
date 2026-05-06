"use client";

import { useEffect, useRef, useState } from "react";

import type { BattleBotAnimationState } from "@nihongo-bjt/shared";

import {
  BattleBotAvatar,
  type BattleBotRiveMetadata
} from "../../../_components/battle-bot-avatar";

export type BattleCountdownOverlayLabels = {
  cancel: string;
  connected: string;
  go: string;
  preparing: string;
  reconnecting: string;
  starting: string;
  startingIn: string;
  vs: string;
};

type BattleCountdownOverlayProps = {
  botDifficultyLabel?: string | null;
  botFallback: string;
  botName: string;
  botRive: BattleBotRiveMetadata;
  botState: BattleBotAnimationState;
  connectionStatus?: boolean;
  countdownLabels: BattleCountdownOverlayLabels;
  countdownValue: number | null;
  onCancel?: () => void;
  onComplete: () => void;
  /** Human = second fighter uses initials (PvP); bot = Rive avatar */
  opponentPresentation?: "bot" | "human";
  userDisplayName: string;
  visible: boolean;
};

const COUNTDOWN_SFX_PATH = "/assets/battle/sfx/countdown-tick.mp3";
const BATTLE_START_SFX_PATH = "/assets/battle/sfx/battle-start.mp3";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function useSfxEnabled() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("battle_sfx_enabled");
      if (stored === "false") setEnabled(false);
    } catch {
      // ignore
    }
  }, []);
  return enabled;
}

export function BattleCountdownOverlay({
  botDifficultyLabel,
  botFallback,
  botName,
  botRive,
  botState,
  connectionStatus,
  countdownLabels,
  countdownValue,
  onCancel,
  onComplete,
  opponentPresentation = "bot",
  userDisplayName,
  visible
}: BattleCountdownOverlayProps) {
  const reducedMotion = useReducedMotion();
  const sfxEnabled = useSfxEnabled();
  const [phase, setPhase] = useState<"countdown" | "go" | "hidden">("hidden");
  const [displayValue, setDisplayValue] = useState<string | null>(null);
  const [exiting, setExiting] = useState(false);
  const tickAudioRef = useRef<HTMLAudioElement | null>(null);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const completedRef = useRef(false);

  // Preload audio
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      tickAudioRef.current = new Audio(COUNTDOWN_SFX_PATH);
      tickAudioRef.current.volume = 0.3;
      startAudioRef.current = new Audio(BATTLE_START_SFX_PATH);
      startAudioRef.current.volume = 0.4;
    } catch {
      // Audio not available
    }
  }, []);

  // Track countdown value changes
  useEffect(() => {
    if (!visible) {
      setPhase("hidden");
      setDisplayValue(null);
      setExiting(false);
      completedRef.current = false;
      return;
    }

    if (countdownValue === null) return;

    if (countdownValue > 0) {
      setPhase("countdown");
      setDisplayValue(String(countdownValue));
      // Play tick
      if (sfxEnabled && !reducedMotion) {
        try {
          const audio = tickAudioRef.current;
          if (audio) {
            audio.currentTime = 0;
            void audio.play().catch(() => {});
          }
        } catch {
          // ignore
        }
      }
    } else if (countdownValue === 0 && !completedRef.current) {
      setPhase("go");
      setDisplayValue(countdownLabels.go);
      // Play start sound
      if (sfxEnabled && !reducedMotion) {
        try {
          const audio = startAudioRef.current;
          if (audio) {
            audio.currentTime = 0;
            void audio.play().catch(() => {});
          }
        } catch {
          // ignore
        }
      }
      // Fade out after 800ms
      completedRef.current = true;
      setTimeout(() => {
        setExiting(true);
        setTimeout(() => {
          onComplete();
        }, 300);
      }, 800);
    }
  }, [visible, countdownValue, sfxEnabled, reducedMotion, onComplete, countdownLabels.go]);

  if (!visible && phase === "hidden") return null;

  // Reduced motion: simple static text
  if (reducedMotion) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-ink/85 backdrop-blur-sm">
        <div className="text-center">
          <p className="text-lg font-bold text-white/60">
            {userDisplayName} {countdownLabels.vs} {botName}
          </p>
          {botDifficultyLabel ? (
            <span className="mt-2 inline-block rounded-full border border-white/20 px-3 py-0.5 text-xs font-black uppercase text-white/70">
              {botDifficultyLabel}
            </span>
          ) : null}
          <p className="mt-4 text-4xl font-black text-white">
            {countdownValue !== null && countdownValue > 0
              ? countdownLabels.startingIn.replace("{n}", String(countdownValue))
              : countdownLabels.starting}
          </p>
          {onCancel ? (
            <button
              className="mt-6 rounded-xl border border-white/20 px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/10"
              onClick={onCancel}
              type="button"
            >
              {countdownLabels.cancel}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/85 backdrop-blur-sm transition-opacity duration-300 ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Connection status */}
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${connectionStatus !== false ? "bg-leaf" : "bg-amber"}`} />
        <span className="text-xs font-bold text-white/50">
          {connectionStatus !== false ? countdownLabels.connected : countdownLabels.reconnecting}
        </span>
      </div>

      {/* Cancel button (top-right) */}
      {onCancel ? (
        <button
          className="absolute right-4 top-4 rounded-xl border border-white/20 px-3 py-1.5 text-xs font-bold text-white/60 transition hover:bg-white/10 hover:text-white/80"
          onClick={onCancel}
          type="button"
        >
          {countdownLabels.cancel}
        </button>
      ) : null}

      {/* Decorative glow particles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-1/4 top-1/3 h-32 w-32 animate-pulse rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 h-24 w-24 animate-pulse rounded-full bg-leaf/20 blur-3xl" style={{ animationDelay: "0.5s" }} />
        <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-sakura/10 blur-3xl" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative flex w-full max-w-2xl items-center justify-center gap-6 px-4 sm:gap-10">
        {/* Player side */}
        <div className="flex flex-col items-center gap-3 animate-in slide-in-from-left-8 duration-500">
          <div className="relative">
            <div className="grid h-20 w-20 place-items-center rounded-2xl bg-white/10 text-2xl font-black text-white shadow-lg shadow-accent/20 ring-2 ring-white/20 sm:h-24 sm:w-24">
              {userDisplayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="absolute -inset-1 -z-10 animate-pulse rounded-2xl bg-accent/30 blur-md" />
          </div>
          <p className="max-w-[8rem] truncate text-center text-sm font-black text-white/80">
            {userDisplayName}
          </p>
        </div>

        {/* VS + Countdown center */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-black uppercase tracking-widest text-white/40">{countdownLabels.vs}</p>
          {botDifficultyLabel ? (
            <span className="rounded-full border border-white/25 px-2.5 py-0.5 text-[10px] font-black uppercase text-white/75">
              {botDifficultyLabel}
            </span>
          ) : null}
          {displayValue !== null ? (
            <div
              className="relative grid h-20 w-20 place-items-center sm:h-24 sm:w-24"
              key={String(displayValue)}
            >
              <span
                className={`text-5xl font-black sm:text-6xl ${
                  phase === "go" ? "text-leaf" : "text-white"
                }`}
                style={{
                  animation: "battle-count-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
                }}
              >
                {displayValue}
              </span>
            </div>
          ) : (
            <div className="grid h-20 w-20 place-items-center sm:h-24 sm:w-24">
              <span className="animate-pulse text-center text-sm font-black leading-tight text-white/45">
                {countdownLabels.preparing}
              </span>
            </div>
          )}
        </div>

        {/* Opponent side */}
        <div className="flex flex-col items-center gap-3 animate-in slide-in-from-right-8 duration-500">
          <div className="relative">
            {opponentPresentation === "human" ? (
              <div className="grid h-20 w-20 place-items-center rounded-2xl bg-white/10 text-lg font-black text-white shadow-lg shadow-rose-500/20 ring-2 ring-white/20 sm:h-24 sm:w-24">
                {botName.slice(0, 2).toUpperCase()}
              </div>
            ) : (
              <BattleBotAvatar
                className="h-20 w-20 rounded-2xl shadow-lg shadow-sakura/20 ring-2 ring-white/20 sm:h-24 sm:w-24"
                fallback={botFallback}
                rive={botRive}
                state={botState}
              />
            )}
            <div
              className={`absolute -inset-1 -z-10 animate-pulse rounded-2xl blur-md ${opponentPresentation === "human" ? "bg-rose-500/35" : "bg-sakura/30"}`}
            />
          </div>
          <p className="max-w-[8rem] truncate text-center text-sm font-black text-white/80">
            {botName}
          </p>
        </div>
      </div>
    </div>
  );
}
