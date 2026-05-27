import type { ReactNode } from "react";

/* ─── Theme gradients ─── */

export const themeGradients: Record<string, { bg: string; badge: string }> = {
  blue_corporate: { bg: "from-slate-950 via-blue-900 to-blue-700", badge: "from-blue-500 to-blue-700" },
  indigo_culture: { bg: "from-indigo-900 via-indigo-800 to-purple-700", badge: "from-indigo-500 to-purple-600" },
  indigo_news: { bg: "from-indigo-900 via-blue-800 to-cyan-700", badge: "from-blue-500 to-cyan-600" },
  green_life: { bg: "from-emerald-900 via-emerald-800 to-teal-700", badge: "from-emerald-500 to-teal-600" },
  sky_weather: { bg: "from-sky-900 via-sky-700 to-cyan-600", badge: "from-sky-500 to-cyan-500" },
  slate_procedure: { bg: "from-slate-800 via-slate-700 to-zinc-600", badge: "from-slate-500 to-zinc-500" },
  amber_money: { bg: "from-amber-800 via-amber-700 to-yellow-600", badge: "from-amber-500 to-yellow-500" },
  red_safety: { bg: "from-red-900 via-red-800 to-rose-700", badge: "from-red-500 to-rose-600" },
  purple_ai: { bg: "from-purple-900 via-purple-800 to-violet-700", badge: "from-purple-500 to-violet-600" },
  teal_health: { bg: "from-teal-900 via-teal-800 to-emerald-700", badge: "from-teal-500 to-emerald-500" },
  cyan_transport: { bg: "from-cyan-900 via-cyan-800 to-sky-700", badge: "from-cyan-500 to-sky-500" },
  rose_family: { bg: "from-rose-900 via-rose-800 to-pink-700", badge: "from-rose-500 to-pink-500" },
};

export const defaultTheme = { bg: "from-slate-950 via-blue-900 to-blue-700", badge: "from-blue-500 to-blue-700" };

/* ─── Props ─── */

export type DetailHeroHeaderProps = {
  /** Gradient class string for background (e.g. "from-slate-950 via-blue-900 to-blue-700") */
  bgGradient: string;
  /** Badge elements rendered at the top */
  badges?: ReactNode;
  /** Main title (Vietnamese or primary language) */
  title: string;
  /** Japanese title shown below main title */
  titleJa?: string | null;
  /** Meta info elements rendered below the title */
  metaInfo?: ReactNode;
};

/* ─── Component ─── */

export function DetailHeroHeader({
  bgGradient,
  badges,
  title,
  titleJa,
  metaInfo,
}: DetailHeroHeaderProps) {
  return (
    <header className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${bgGradient} p-6 text-white shadow-xl sm:p-8`}>
      {/* Decorative blurs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
      </div>

      <div className="relative">
        {/* Badges */}
        {badges && <div className="flex flex-wrap items-center gap-2">{badges}</div>}

        {/* Title */}
        <h1 className={`${badges ? "mt-5" : ""} text-2xl font-bold leading-tight sm:text-3xl`}>
          {title}
        </h1>
        {titleJa && (
          <p className="mt-2 text-lg font-medium text-white/80" lang="ja" style={{ lineHeight: "1.8" }}>
            {titleJa}
          </p>
        )}

        {/* Meta info */}
        {metaInfo && <div className="mt-5 flex flex-wrap items-center gap-3">{metaInfo}</div>}
      </div>
    </header>
  );
}
