"use client";

import type { LotoGame } from "./loto-types";

interface Props {
  game: LotoGame;
  onChange: (game: LotoGame) => void;
  labelLoto6: string;
  labelLoto7: string;
}

const OPTIONS: Array<{ game: LotoGame; active: string }> = [
  { game: "loto6", active: "bg-emerald-500 text-white shadow-md" },
  { game: "loto7", active: "bg-cyan-500 text-white shadow-md" }
];

export function LotoGameToggle({ game, onChange, labelLoto6, labelLoto7 }: Props) {
  const labels: Record<LotoGame, string> = { loto6: labelLoto6, loto7: labelLoto7 };
  return (
    <div
      role="group"
      className="flex items-center gap-1 rounded-2xl bg-surface/80 p-1 shadow-sm ring-1 ring-border/30"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.game}
          type="button"
          aria-pressed={game === option.game}
          onClick={() => onChange(option.game)}
          className={`min-h-11 flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
            game === option.game ? option.active : "text-muted hover:bg-accent/10 hover:text-ink"
          }`}
        >
          {labels[option.game]}
        </button>
      ))}
    </div>
  );
}
