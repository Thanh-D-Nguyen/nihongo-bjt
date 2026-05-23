"use client";

import { cn } from "@nihongo-bjt/ui";
import { useMemo, useState } from "react";

import { type AmbientSound, useAmbientMode } from "../_hooks/use-ambient-mode";

export interface AmbientMiniPlayerLabels {
  ariaLabel: string;
  collapse: string;
  expand: string;
  error: string;
  focusMode: string;
  muted: string;
  pause: string;
  play: string;
  soundCafe: string;
  soundLofi: string;
  soundNature: string;
  soundRain: string;
  volume: string;
}

const SOUND_META: Array<{ icon: string; key: Exclude<AmbientSound, "none">; labelKey: keyof AmbientMiniPlayerLabels }> = [
  { icon: "♪", key: "lofi", labelKey: "soundLofi" },
  { icon: "雨", key: "rain", labelKey: "soundRain" },
  { icon: "喫", key: "cafe", labelKey: "soundCafe" },
  { icon: "森", key: "nature", labelKey: "soundNature" }
];

export function AmbientMiniPlayer({ labels }: { labels: AmbientMiniPlayerLabels }) {
  const { active, ducked, error, pause, play, setSound, setVolume, sound, volume } = useAmbientMode();
  const [expanded, setExpanded] = useState(true);

  const activeSoundLabel = useMemo(() => {
    const item = SOUND_META.find((s) => s.key === sound);
    return item ? labels[item.labelKey] : labels.soundLofi;
  }, [labels, sound]);

  if (!active && !error) return null;

  return (
    <aside
      aria-label={labels.ariaLabel}
      className={cn(
        "fixed bottom-[calc(10.5rem+env(safe-area-inset-bottom))] right-3 z-[70] w-[min(calc(100vw-1.5rem),23rem)]",
        "rounded-2xl border border-white/70 bg-white/90 p-2 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl",
        "dark:border-white/10 dark:bg-slate-900/90 sm:right-5 lg:bottom-[calc(10.5rem+env(safe-area-inset-bottom))]"
      )}
    >
      <div className="flex items-center gap-2">
        <button
          aria-label={active ? labels.pause : labels.play}
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-black text-white shadow-sm transition",
            active ? "bg-leaf hover:bg-leaf/90" : "bg-ink hover:bg-ink/90"
          )}
          onClick={active ? pause : play}
          type="button"
        >
          {active ? "Ⅱ" : "▶"}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-xs font-black text-ink">{labels.focusMode}</p>
            {ducked ? (
              <span className="rounded-full bg-amber-soft px-1.5 py-0.5 text-[9px] font-black text-amber">
                {labels.muted}
              </span>
            ) : null}
          </div>
          <p className="truncate text-[11px] font-semibold text-muted">{activeSoundLabel}</p>
        </div>

        <button
          aria-expanded={expanded}
          aria-label={expanded ? labels.collapse : labels.expand}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink/10 bg-paper text-xs font-black text-muted transition hover:bg-white hover:text-ink"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded ? "⌄" : "⌃"}
        </button>
      </div>

      {expanded ? (
        <div className="mt-2 border-t border-ink/8 pt-2">
          <div className="grid grid-cols-4 gap-1.5">
            {SOUND_META.map((item) => (
              <button
                aria-pressed={sound === item.key}
                className={cn(
                  "min-h-10 rounded-lg border px-2 text-center transition",
                  sound === item.key
                    ? "border-leaf bg-leaf text-white shadow-sm"
                    : "border-ink/8 bg-paper text-muted hover:border-leaf/30 hover:bg-leaf-soft hover:text-leaf"
                )}
                key={item.key}
                onClick={() => setSound(item.key)}
                type="button"
              >
                <span className="block text-[11px] font-black">{item.icon}</span>
                <span className="block truncate text-[9px] font-bold">{labels[item.labelKey]}</span>
              </button>
            ))}
          </div>

          <label className="mt-2 flex items-center gap-2 text-[10px] font-bold text-muted">
            <span className="shrink-0">{labels.volume}</span>
            <input
              aria-label={labels.volume}
              className="h-1 flex-1 appearance-none rounded-full bg-ink/15 accent-leaf"
              max={100}
              min={0}
              onChange={(event) => setVolume(Number(event.target.value))}
              type="range"
              value={volume}
            />
            <span className="w-7 text-right tabular-nums">{volume}</span>
          </label>

          {error ? (
            <p className="mt-2 rounded-lg bg-sakura-soft px-2 py-1 text-[10px] font-bold text-sakura">
              {labels.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
