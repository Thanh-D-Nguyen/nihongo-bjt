"use client";

type LotoGame = "loto6" | "loto7";

interface Props {
  game: LotoGame;
  onChange: (game: LotoGame) => void;
  labelLoto6: string;
  labelLoto7: string;
}

export function LotoGameToggle({ game, onChange, labelLoto6, labelLoto7 }: Props) {
  return (
    <div className="flex items-center gap-1 rounded-2xl bg-surface/80 p-1 shadow-sm ring-1 ring-border/30">
      <button
        onClick={() => onChange("loto6")}
        className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
          game === "loto6"
            ? "bg-emerald-500 text-white shadow-md"
            : "text-muted hover:bg-accent/10 hover:text-ink"
        }`}
      >
        {labelLoto6}
      </button>
      <button
        onClick={() => onChange("loto7")}
        className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
          game === "loto7"
            ? "bg-cyan-500 text-white shadow-md"
            : "text-muted hover:bg-accent/10 hover:text-ink"
        }`}
      >
        {labelLoto7}
      </button>
    </div>
  );
}
