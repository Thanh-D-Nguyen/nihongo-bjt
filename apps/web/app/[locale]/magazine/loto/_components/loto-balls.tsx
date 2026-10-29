"use client";

import type { LotoGame } from "./loto-types";

const MAIN_BALL: Record<LotoGame, string> = {
  loto6: "bg-emerald-500 text-white",
  loto7: "bg-cyan-500 text-white"
};

const SIZE = {
  sm: "size-7 text-xs",
  md: "size-8 text-xs",
  lg: "size-10 text-sm sm:size-12 sm:text-base"
} as const;

export function LotoBall({
  value,
  game,
  size = "md",
  state = "plain"
}: {
  value: number;
  game: LotoGame;
  size?: keyof typeof SIZE;
  /** hit = matched the official draw, miss = did not, plain = no comparison yet. */
  state?: "plain" | "hit" | "miss" | "result";
}) {
  const tone =
    state === "hit"
      ? "bg-green-500 text-white ring-2 ring-green-400/40"
      : state === "miss"
        ? "bg-border/30 text-ink/70"
        : state === "result"
          ? "bg-ink/10 text-ink"
          : `${MAIN_BALL[game]} shadow-md`;
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums ${SIZE[size]} ${tone}`}
    >
      {value}
    </span>
  );
}

export function LotoBonusBall({
  value,
  matched = false,
  size = "md"
}: {
  value: number;
  matched?: boolean;
  size?: keyof typeof SIZE;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full border-2 font-bold tabular-nums ${SIZE[size]} ${
        matched ? "border-amber-500 bg-amber-500/15 text-amber-700" : "border-muted/40 text-muted"
      }`}
    >
      {value}
    </span>
  );
}
