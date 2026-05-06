"use client";

import { useEffect, useRef, useState } from "react";

import type { BattleBotAnimationState } from "@nihongo-bjt/shared";

import {
  BattleBotAvatar,
  type BattleBotRiveMetadata
} from "../../../_components/battle-bot-avatar";

type BotDetailPopoverProps = {
  accuracyPct?: number;
  avatarFallback: string;
  /** Raw difficulty for badge color (easy|medium|hard). */
  difficultyKey?: string;
  /** Localized difficulty label. */
  difficultyLabel?: string | null;
  maxDelayMs?: number;
  minDelayMs?: number;
  name: string;
  onClose: () => void;
  persona: string;
  rive: BattleBotRiveMetadata;
  state: BattleBotAnimationState;
  statLabels: {
    accuracy: string;
    speed: string;
    vocab: string;
  };
  styleToken: "calm" | "focused" | "sharp";
  triggerRect: DOMRect;
  vocabularyLabel?: string | null;
  /** Keep popover open when pointer moves from row to bubble. */
  onHoverGroupEnter?: () => void;
  onHoverGroupLeave?: () => void;
  /** One line: bot practice counts toward your personal battle stats. */
  battleRecordHint?: string | null;
};

const difficultyColors: Record<string, string> = {
  easy: "bg-leaf/10 text-leaf border-leaf/20",
  hard: "bg-sakura/10 text-sakura border-sakura/20",
  medium: "bg-amber/10 text-amber border-amber/20"
};

export function BotDetailPopover({
  accuracyPct,
  avatarFallback,
  difficultyKey,
  difficultyLabel,
  maxDelayMs,
  minDelayMs,
  name,
  onClose,
  persona,
  rive,
  state,
  statLabels,
  styleToken,
  triggerRect,
  vocabularyLabel,
  onHoverGroupEnter,
  onHoverGroupLeave,
  battleRecordHint
}: BotDetailPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [visible, setVisible] = useState(false);

  const speedMs =
    minDelayMs && maxDelayMs ? Math.round((minDelayMs + maxDelayMs) / 2) : null;

  useEffect(() => {
    // Position relative to trigger
    const popoverWidth = 280;
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer showing to the left of the trigger on desktop, above on mobile
    let top = triggerRect.top + triggerRect.height / 2 - 100;
    let left = triggerRect.left - popoverWidth - gap;

    // If not enough space on left, show on right
    if (left < 8) {
      left = triggerRect.right + gap;
    }

    // If not enough space on right either, center below
    if (left + popoverWidth > vw - 8) {
      left = Math.max(8, triggerRect.left + triggerRect.width / 2 - popoverWidth / 2);
      top = triggerRect.bottom + gap;
    }

    // Keep within viewport
    top = Math.max(8, Math.min(top, vh - 280));
    left = Math.max(8, Math.min(left, vw - popoverWidth - 8));

    setPosition({ left, top });
    // Animate in
    requestAnimationFrame(() => setVisible(true));
  }, [triggerRect]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const accentMap = {
    calm: "border-sky-200 shadow-sky-100/50",
    focused: "border-accent/20 shadow-accent/10",
    sharp: "border-rose-200 shadow-rose-100/50"
  };

  return (
    <div
      className={`fixed z-50 w-[280px] rounded-2xl border bg-surface p-4 shadow-xl transition-all duration-150 ${
        accentMap[styleToken]
      } ${visible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
      onMouseEnter={onHoverGroupEnter}
      onMouseLeave={onHoverGroupLeave}
      ref={ref}
      role="tooltip"
      style={{ left: position.left, top: position.top }}
    >
      {/* Header with avatar */}
      <div className="flex items-center gap-3">
        <BattleBotAvatar
          className="h-14 w-14 rounded-xl"
          fallback={avatarFallback}
          rive={rive}
          state={state}
          variant="card"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-ink">{name}</p>
          {difficultyLabel ? (
            <span
              className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${
                difficultyKey && difficultyColors[difficultyKey]
                  ? difficultyColors[difficultyKey]
                  : "border-ink/10 bg-paper text-muted"
              }`}
            >
              {difficultyLabel}
            </span>
          ) : null}
        </div>
      </div>

      {/* Persona */}
      <p className="mt-3 text-xs font-medium leading-5 text-muted">{persona}</p>

      {/* Stats grid */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-ink/8 bg-paper p-2">
          <p className="text-[10px] font-bold uppercase text-muted">{statLabels.accuracy}</p>
          <p className="text-sm font-black text-ink">{accuracyPct ?? "--"}%</p>
        </div>
        <div className="rounded-xl border border-ink/8 bg-paper p-2">
          <p className="text-[10px] font-bold uppercase text-muted">{statLabels.speed}</p>
          <p className="text-sm font-black text-ink">{speedMs ? `${speedMs}ms` : "--"}</p>
        </div>
        {vocabularyLabel ? (
          <div className="col-span-2 rounded-xl border border-ink/8 bg-paper p-2">
            <p className="text-[10px] font-bold uppercase text-muted">{statLabels.vocab}</p>
            <p className="text-sm font-black text-ink">{vocabularyLabel}</p>
          </div>
        ) : null}
      </div>
      {battleRecordHint ? (
        <p className="mt-3 border-t border-ink/10 pt-3 text-[11px] font-semibold leading-relaxed text-muted">
          {battleRecordHint}
        </p>
      ) : null}
    </div>
  );
}
