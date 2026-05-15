"use client";

import { cn } from "@nihongo-bjt/ui";
import { useAmbientMode } from "../../../_hooks/use-ambient-mode";

const SOUND_OPTIONS = [
  { key: "lofi" as const, label: "Lo-fi", emoji: "🎵" },
  { key: "rain" as const, label: "Mưa", emoji: "🌧️" },
  { key: "cafe" as const, label: "Café", emoji: "☕" },
  { key: "nature" as const, label: "Thiên nhiên", emoji: "🌿" },
];

export function AmbientModeWidget() {
  const { active, sound, volume, toggle, setSound, setVolume } = useAmbientMode();

  return (
    <div className={cn(
      "rounded-2xl border p-4 shadow-sm transition-all",
      active
        ? "border-[var(--color-leaf)]/30 bg-[var(--color-leaf-soft)] shadow-[0_0_12px_rgba(5,150,105,0.1)]"
        : "border-ink/8 bg-surface",
    )}>
      <button
        onClick={toggle}
        className="flex items-center gap-2 w-full"
      >
        <span className="text-lg">{active ? "🎧" : "🎵"}</span>
        <h3 className="text-sm font-bold text-ink flex-1 text-left">
          {active ? "Café Tokyo" : "Chế độ tập trung"}
        </h3>
        <div className={cn(
          "h-5 w-9 rounded-full transition-colors relative",
          active ? "bg-[var(--color-leaf)]" : "bg-ink/20",
        )}>
          <div className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            active ? "translate-x-4" : "translate-x-0.5",
          )} />
        </div>
      </button>

      {active && (
        <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Sound picker */}
          <div className="grid grid-cols-4 gap-1.5">
            {SOUND_OPTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSound(s.key)}
                className={cn(
                  "rounded-lg py-2 text-center transition-all",
                  sound === s.key
                    ? "bg-[var(--color-leaf)] text-white shadow-sm"
                    : "bg-ink/5 text-muted hover:bg-ink/10",
                )}
              >
                <div className="text-sm">{s.emoji}</div>
                <div className="text-[9px] font-medium mt-0.5">{s.label}</div>
              </button>
            ))}
          </div>

          {/* Volume slider */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted">🔈</span>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="flex-1 h-1 appearance-none rounded-full bg-ink/15 accent-[var(--color-leaf)]"
            />
            <span className="text-[10px] text-muted w-6 text-right">{volume}</span>
          </div>

          <p className="text-[9px] text-muted text-center italic">
            Tập trung vào bài học, để âm thanh dẫn lối 🍵
          </p>
        </div>
      )}
    </div>
  );
}
