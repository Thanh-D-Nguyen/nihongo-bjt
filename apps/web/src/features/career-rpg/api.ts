"use client";

import { learnerApiFetch } from "../../../lib/learner-api";

import type {
  CareerRank,
  CareerSkillStat,
  ChapterResult,
  ContextMemo,
  MissionArc,
  MissionChapter,
  NpcRelation,
  StoryNpc,
  StoryProgress,
  UserCareerState
} from "./types";

export interface CareerMeResponse {
  npcRelations: NpcRelation[];
  npcs: StoryNpc[];
  state: UserCareerState;
}

interface CareerMeRecord {
  companyTheme: string;
  currentRankCode: UserCareerState["currentRankCode"];
  hireDate: string;
  jpWorkName: string;
  lastClockInAt?: string;
  rankXp: number;
  rankXpToNext?: number;
  skills: CareerSkillStat[];
  streakDays: number;
  userId: string;
}

export interface ArcDetailResponse {
  arc: MissionArc;
  chapters: MissionChapter[];
  npcRelations: NpcRelation[];
  npcs: StoryNpc[];
}

export interface ChapterDetailResponse {
  chapter: MissionChapter;
  npcs: StoryNpc[];
  rewardsPayload: unknown;
}

interface ChapterCompleteRecord {
  career: CareerMeRecord;
  rankUp: ChapterCompleteResponse["rankUp"];
  result: ChapterCompleteResponse["result"];
}

export interface ChapterCompleteResponse {
  career: CareerMeResponse;
  rankUp: { fromRankCode: string; toRankCode: string } | null;
  result: ChapterResult & { contextMemoDrops?: unknown[] };
}

export async function careerMe(): Promise<CareerMeResponse> {
  const record = await apiJson<CareerMeRecord>("/api/career/me");
  return toCareerMeResponse(record);
}

export function clockIn() {
  return apiJson<CareerMeResponse>("/api/career/clock-in", {
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
}

export function careerRanks() {
  return apiJson<CareerRank[]>("/api/career/ranks");
}

export function careerInbox() {
  return apiJson<ContextMemo[]>("/api/career/inbox");
}

export function submitContextMemoFeedback(id: string, feedback: "useful" | "fuzzy" | "lost") {
  return apiJson<void>(`/api/career/inbox/${encodeURIComponent(id)}`, {
    body: JSON.stringify({ feedback }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH"
  });
}

export async function updateCareerProfile(data: { jpWorkName: string }): Promise<CareerMeResponse> {
  const record = await apiJson<CareerMeRecord>("/api/career/me", {
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
    method: "PATCH"
  });
  return toCareerMeResponse(record);
}

export async function storyArcs(): Promise<MissionArc[]> {
  const records = await apiJson<StoryArcRecord[]>("/api/story/arcs");
  return records.map(toMissionArc);
}

export async function storyArcDetail(slug: string): Promise<ArcDetailResponse> {
  const record = await apiJson<StoryArcDetailRecord>(`/api/story/arcs/${encodeURIComponent(slug)}`);
  return toArcDetailResponse(record);
}

export function storyChapter(id: string) {
  return apiJson<ChapterDetailResponse>(`/api/story/chapters/${encodeURIComponent(id)}`);
}

export function startChapterAttempt(id: string) {
  return apiJson<unknown>(`/api/story/chapters/${encodeURIComponent(id)}/attempts`, {
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
}

/** The signed-in learner's story progress, or null when there is no session. */
export async function storyProgress(): Promise<StoryProgress | null> {
  const response = await learnerApiFetch("/api/story/progress", undefined);
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`Career RPG API failed: ${response.status}`);
  }
  return (await response.json()) as StoryProgress;
}

/** Completes the in-progress attempt; `optionKey` is the answer the learner chose (a wrong one earns less). */
export async function completeCurrentChapterAttempt(id: string, optionKey?: string): Promise<ChapterCompleteResponse> {
  const record = await apiJson<ChapterCompleteRecord>(
    `/api/story/chapters/${encodeURIComponent(id)}/attempts/current/complete`,
    {
      body: JSON.stringify(optionKey ? { optionKey } : {}),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }
  );
  return { career: toCareerMeResponse(record.career), rankUp: record.rankUp, result: record.result };
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await learnerApiFetch(path, init);
  if (!response.ok) {
    throw new Error(`Career RPG API failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

// The Go list endpoint only returns published arcs with these fields; it carries no per-learner progress.
interface StoryArcRecord {
  displayOrder: number;
  rankCodeEntry: MissionArc["rankCodeEntry"];
  slug: string;
  status: string;
  titleJa: string;
  titleVi: string;
  synopsisVi?: string;
  npcSlugs?: string[];
  artAccent?: string;
  chapterIds?: string[];
}

interface StoryArcDetailRecord extends Omit<StoryArcRecord, "displayOrder"> {
  chapters: Array<{
    displayOrder?: number;
    estimatedMinutes?: number;
    id: string;
    isBoss?: boolean;
    slug: string;
    titleJa: string;
    titleVi: string;
  }>;
  storyPayload?: { synopsisVi?: string; npcSlugs?: string[]; artAccent?: string } | null;
}

const NEUTRAL_ARC_ACCENT = "#94A3B8";
const UI_ARC_STATUSES: ReadonlySet<string> = new Set<MissionArc["status"]>(["draft", "active", "completed", "locked"]);

function toMissionArc(record: StoryArcRecord): MissionArc {
  return {
    slug: record.slug,
    titleJa: record.titleJa,
    titleVi: record.titleVi,
    rankCodeEntry: record.rankCodeEntry,
    displayOrder: record.displayOrder,
    // "published" is the catalogue state of a readable arc; an unrecognized state is locked rather than guessed.
    status: record.status === "published" ? "active" : UI_ARC_STATUSES.has(record.status) ? (record.status as MissionArc["status"]) : "locked",
    synopsisVi: record.synopsisVi ?? "",
    npcSlugs: record.npcSlugs ?? [],
    chapterIds: record.chapterIds ?? [],
    totalChapters: record.chapterIds?.length ?? 0,
    completedChapters: 0,
    bossChapterId: null,
    artAccent: record.artAccent || NEUTRAL_ARC_ACCENT,
    progressTracked: false
  };
}

function toArcDetailResponse(record: StoryArcDetailRecord): ArcDetailResponse {
  const payload = record.storyPayload ?? {};
  const chapters: MissionChapter[] = record.chapters.map((chapter, index) => ({
    id: chapter.id,
    arcSlug: record.slug,
    slug: chapter.slug,
    displayOrder: chapter.displayOrder ?? index + 1,
    titleJa: chapter.titleJa,
    titleVi: chapter.titleVi,
    briefingJa: "",
    briefingVi: "",
    yourRoleVi: "",
    isBoss: chapter.isBoss ?? false,
    scenarios: [],
    estimatedMinutes: chapter.estimatedMinutes ?? 0
  }));
  return {
    arc: {
      ...toMissionArc({ ...record, ...payload, displayOrder: 0 }),
      chapterIds: chapters.map((chapter) => chapter.id),
      totalChapters: chapters.length,
      bossChapterId: chapters.find((chapter) => chapter.isBoss)?.id ?? null
    },
    chapters,
    // The Go API has no per-learner NPC relations or public NPC bios on the arc endpoint yet.
    npcRelations: [],
    npcs: []
  };
}

function toCareerMeResponse(record: CareerMeRecord): CareerMeResponse {
  return {
    state: {
      ...record,
      rankXpToNext: record.rankXpToNext ?? 0,
      lastClockInAt: record.lastClockInAt ?? null
    },
    npcRelations: [],
    npcs: []
  };
}
