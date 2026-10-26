import type { ArcDetailResponse } from "./api";
import { storyProgress } from "./api";
import { findRankByCode } from "./helpers";
import type { MissionArc, StoryProgress } from "./types";

/** The learner's progress, or null when signed out. Other failures propagate to the page's error state. */
export async function loadStoryProgress(): Promise<StoryProgress | null> {
  return (await storyProgress()) ?? null;
}

/** An arc is locked when its entry rank is above the learner's rank; unknown ranks never lock. */
function isAboveRank(arc: MissionArc, currentRankCode: string): boolean {
  const entry = findRankByCode(arc.rankCodeEntry)?.displayOrder;
  const current = findRankByCode(currentRankCode as MissionArc["rankCodeEntry"])?.displayOrder;
  return entry !== undefined && current !== undefined && entry > current;
}

function withProgress(arc: MissionArc, completedChapters: number, progress: StoryProgress): MissionArc {
  const finished = arc.totalChapters > 0 && completedChapters >= arc.totalChapters;
  return {
    ...arc,
    completedChapters,
    progressTracked: true,
    status: isAboveRank(arc, progress.currentRankCode) ? "locked" : finished ? "completed" : "active"
  };
}

/** Merges the learner's progress into the public arcs list; signed-out learners keep the plain list. */
export function applyStoryProgress(arcs: MissionArc[], progress: StoryProgress | null): MissionArc[] {
  if (!progress) return arcs;
  return arcs.map((arc) => withProgress(arc, progress.arcs[arc.slug] ?? 0, progress));
}

/** Same merge for one arc page, counting completed chapters by id. */
export function applyStoryProgressToDetail(detail: ArcDetailResponse, progress: StoryProgress | null): ArcDetailResponse {
  if (!progress) return detail;
  const done = new Set(progress.completedChapterIds);
  const completed = detail.chapters.filter((chapter) => done.has(chapter.id)).length;
  return { ...detail, arc: withProgress(detail.arc, completed, progress) };
}
