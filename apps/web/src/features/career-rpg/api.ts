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

export function storyArcDetail(slug: string) {
  return apiJson<ArcDetailResponse>(`/api/story/arcs/${encodeURIComponent(slug)}`);
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

export function completeCurrentChapterAttempt(id: string) {
  return apiJson<ChapterCompleteResponse>(
    `/api/story/chapters/${encodeURIComponent(id)}/attempts/current/complete`,
    {
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }
  );
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
    synopsisVi: "",
    npcSlugs: [],
    chapterIds: [],
    totalChapters: 0,
    completedChapters: 0,
    bossChapterId: null,
    artAccent: NEUTRAL_ARC_ACCENT
  };
}

function toCareerMeResponse(record: CareerMeRecord): CareerMeResponse {
  return {
    state: {
      ...record,
      rankXpToNext: 0,
      lastClockInAt: record.lastClockInAt ?? null
    },
    npcRelations: [],
    npcs: []
  };
}
