/** Seasonal decorative SVG elements — sakura petals, waves, momiji, snowflakes. */

import type { SVGProps } from "react";
import type { Season } from "../seasonal";

/* ── Sakura petal (spring) ────────────────────────────────────────────── */
function SakuraPetal({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M10 0C10 0 6 5 6 10s4 10 4 10c0 0 4-5 4-10S10 0 10 0Z" opacity="0.6" />
      <path d="M0 10c0 0 5-4 10-4s10 4 10 4c0 0-5 4-10 4S0 10 0 10Z" opacity="0.4" />
    </svg>
  );
}

/* ── Wave line (summer) ───────────────────────────────────────────────── */
function WaveLine({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 200 30" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M0 15 Q25 0 50 15 T100 15 T150 15 T200 15" opacity="0.5" />
      <path d="M0 22 Q25 7 50 22 T100 22 T150 22 T200 22" opacity="0.3" />
    </svg>
  );
}

/* ── Momiji leaf (autumn) ─────────────────────────────────────────────── */
function MomijiLeaf({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M12 2 L14 8 L20 6 L16 11 L22 12 L16 14 L19 20 L12 16 L5 20 L8 14 L2 12 L8 11 L4 6 L10 8 Z" opacity="0.6" />
      <line opacity="0.4" stroke="currentColor" strokeWidth="0.8" x1="12" x2="12" y1="16" y2="23" />
    </svg>
  );
}

/* ── Snowflake (winter) ───────────────────────────────────────────────── */
function Snowflake({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" {...props}>
      <line opacity="0.6" x1="10" x2="10" y1="1" y2="19" />
      <line opacity="0.6" x1="2.2" x2="17.8" y1="5.5" y2="14.5" />
      <line opacity="0.6" x1="2.2" x2="17.8" y1="14.5" y2="5.5" />
      <line opacity="0.3" x1="10" x2="7" y1="1" y2="3.5" />
      <line opacity="0.3" x1="10" x2="13" y1="1" y2="3.5" />
      <line opacity="0.3" x1="10" x2="7" y1="19" y2="16.5" />
      <line opacity="0.3" x1="10" x2="13" y1="19" y2="16.5" />
    </svg>
  );
}

/* ── Exported composite — renders the right set for current season ──── */

export interface SeasonalOverlayProps {
  season: Season;
  className?: string;
}

export function SeasonalOverlay({ season, className }: SeasonalOverlayProps) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}>
      {season === "spring" && (
        <>
          <SakuraPetal className="absolute right-[12%] top-[8%] h-5 w-5 rotate-[25deg] text-pink-300/[0.10] motion-safe:animate-[drift_10s_ease-in-out_infinite]" />
          <SakuraPetal className="absolute left-[20%] top-[18%] h-4 w-4 -rotate-12 text-pink-200/[0.08] motion-safe:animate-[drift_12s_ease-in-out_infinite_1s]" />
          <SakuraPetal className="absolute right-[30%] bottom-[15%] h-6 w-6 rotate-45 text-pink-300/[0.07] motion-safe:animate-[drift_14s_ease-in-out_infinite_2s]" />
          <SakuraPetal className="absolute left-[45%] bottom-[25%] h-3 w-3 rotate-[60deg] text-pink-200/[0.06]" />
        </>
      )}
      {season === "summer" && (
        <>
          <WaveLine className="absolute -left-4 bottom-2 w-[110%] text-cyan-300/[0.08]" />
          <WaveLine className="absolute -left-8 bottom-6 w-[115%] text-cyan-200/[0.05]" />
        </>
      )}
      {season === "autumn" && (
        <>
          <MomijiLeaf className="absolute right-[15%] top-[10%] h-5 w-5 rotate-12 text-amber-400/[0.10] motion-safe:animate-[drift_11s_ease-in-out_infinite]" />
          <MomijiLeaf className="absolute left-[25%] bottom-[20%] h-4 w-4 -rotate-[30deg] text-red-400/[0.08] motion-safe:animate-[drift_13s_ease-in-out_infinite_1.5s]" />
          <MomijiLeaf className="absolute right-[40%] top-[30%] h-3 w-3 rotate-45 text-orange-400/[0.07]" />
        </>
      )}
      {season === "winter" && (
        <>
          <Snowflake className="absolute right-[10%] top-[12%] h-4 w-4 text-slate-200/[0.12] motion-safe:animate-[drift_9s_ease-in-out_infinite]" />
          <Snowflake className="absolute left-[18%] top-[25%] h-3 w-3 text-blue-100/[0.08] motion-safe:animate-[drift_12s_ease-in-out_infinite_2s]" />
          <Snowflake className="absolute right-[35%] bottom-[18%] h-5 w-5 text-slate-300/[0.09] motion-safe:animate-[drift_14s_ease-in-out_infinite_1s]" />
          <Snowflake className="absolute left-[40%] bottom-[30%] h-3 w-3 text-blue-200/[0.06]" />
          <Snowflake className="absolute right-[55%] top-[8%] h-2 w-2 text-slate-200/[0.07]" />
        </>
      )}
    </div>
  );
}
