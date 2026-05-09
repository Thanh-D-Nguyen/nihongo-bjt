import type { CareerRank, RankCode, SkillAxisCode, UserCareerState } from "./types";
import { mockCareerRanks } from "./mock-data";

export const SKILL_AXES: SkillAxisCode[] = [
  "keigo",
  "written",
  "meeting",
  "customer",
  "chart",
  "nuance"
];

export function timeOfDayBucket(date: Date = new Date()): "morning" | "afternoon" | "evening" {
  const h = date.getHours();
  if (h < 11) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

export function findRankByCode(code: RankCode): CareerRank | undefined {
  return mockCareerRanks.find((r) => r.rankCode === code);
}

export function nextRank(code: RankCode): CareerRank | undefined {
  const cur = findRankByCode(code);
  if (!cur) return undefined;
  return mockCareerRanks.find((r) => r.displayOrder === cur.displayOrder + 1);
}

export function rankProgressPct(state: UserCareerState): number {
  if (state.rankXpToNext <= 0) return 100;
  return Math.min(100, Math.round((state.rankXp / state.rankXpToNext) * 100));
}

export function skillValue(state: UserCareerState, axis: SkillAxisCode): number {
  return state.skills.find((s) => s.axisCode === axis)?.value ?? 0;
}

export function skillFloorMet(state: UserCareerState, floor: number): boolean {
  return SKILL_AXES.every((a) => skillValue(state, a) >= floor);
}

/** Plot 6 axes around a unit circle. Index 0 = top, clockwise. */
export function radarAxisPoint(idx: number, total: number, value: number): { x: number; y: number } {
  const angle = (Math.PI * 2 * idx) / total - Math.PI / 2;
  return { x: Math.cos(angle) * value, y: Math.sin(angle) * value };
}

export function clampDelta(value: number, min = -100, max = 100): number {
  return Math.max(min, Math.min(max, value));
}
