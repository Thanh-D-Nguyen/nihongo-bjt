/** Seasonal detection utility — pure client-side date math, no API calls. */

export type Season = "spring" | "summer" | "autumn" | "winter";

export interface SeasonTheme {
  /** CSS gradient for accent elements (Tailwind classes) */
  accentGradient: string;
  /** Hero overlay tint (CSS rgba) */
  heroTint: string;
  /** Emoji for season */
  emoji: string;
  season: Season;
  /** CSS color stops for programmatic gradient use */
  accentFrom: string;
  accentTo: string;
}

const THEMES: Record<Season, SeasonTheme> = {
  spring: {
    accentGradient: "from-pink-300 to-pink-200",
    heroTint: "rgba(249,168,212,0.04)",
    emoji: "🌸",
    season: "spring",
    accentFrom: "#F9A8D4",
    accentTo: "#FBCFE8",
  },
  summer: {
    accentGradient: "from-cyan-400 to-cyan-300",
    heroTint: "rgba(6,182,212,0.03)",
    emoji: "🌊",
    season: "summer",
    accentFrom: "#06B6D4",
    accentTo: "#22D3EE",
  },
  autumn: {
    accentGradient: "from-amber-400 to-red-400",
    heroTint: "rgba(245,158,11,0.04)",
    emoji: "🍁",
    season: "autumn",
    accentFrom: "#F59E0B",
    accentTo: "#EF4444",
  },
  winter: {
    accentGradient: "from-slate-200 to-slate-100",
    heroTint: "rgba(226,232,240,0.05)",
    emoji: "❄️",
    season: "winter",
    accentFrom: "#E2E8F0",
    accentTo: "#F8FAFC",
  },
};

export function getCurrentSeason(): Season {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

export function getSeasonTheme(): SeasonTheme {
  return THEMES[getCurrentSeason()];
}
