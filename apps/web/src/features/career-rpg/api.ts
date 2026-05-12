"use client";

import { learnerApiFetch } from "../../../lib/learner-api";
import { isWebKeycloakEnabled } from "../../../lib/public-keycloak";

import type { CareerRank, ChapterResult, MissionArc, MissionChapter, NpcRelation, StoryNpc, UserCareerState } from "./types";

const DEV_CAREER_USER_ID = "00000000-0000-4000-8000-000000000101";

export interface CareerMeResponse {
  nextRank: CareerRank | null;
  npcRelations: NpcRelation[];
  npcs: StoryNpc[];
  rank: CareerRank;
  state: UserCareerState;
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

export function careerMe() {
  return apiJson<CareerMeResponse>(withDevUser("/api/career/me"));
}

export function clockIn() {
  return apiJson<CareerMeResponse>("/api/career/clock-in", {
    body: devBody(),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
}

export function careerRanks() {
  return apiJson<CareerRank[]>("/api/career/ranks");
}

export function updateCareerProfile(data: { jpWorkName: string }) {
  const body = { ...data, ...(isWebKeycloakEnabled() ? {} : { userId: DEV_CAREER_USER_ID }) };
  return apiJson<CareerMeResponse>("/api/career/me", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "PATCH"
  });
}

export function storyArcs() {
  return apiJson<MissionArc[]>(withDevUser("/api/story/arcs"));
}

export function storyArcDetail(slug: string) {
  return apiJson<ArcDetailResponse>(withDevUser(`/api/story/arcs/${encodeURIComponent(slug)}`));
}

export function storyChapter(id: string) {
  return apiJson<ChapterDetailResponse>(withDevUser(`/api/story/chapters/${encodeURIComponent(id)}`));
}

export function startChapterAttempt(id: string) {
  return apiJson<unknown>(`/api/story/chapters/${encodeURIComponent(id)}/attempts`, {
    body: devBody(),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
}

export function completeCurrentChapterAttempt(id: string) {
  return apiJson<ChapterCompleteResponse>(`/api/story/chapters/${encodeURIComponent(id)}/attempts/current/complete`, {
    body: devBody(),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await learnerApiFetch(path, init);
  if (!response.ok) {
    throw new Error(`Career RPG API failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function withDevUser(path: string) {
  if (isWebKeycloakEnabled()) {
    return path;
  }
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}userId=${encodeURIComponent(DEV_CAREER_USER_ID)}`;
}

function devBody() {
  return isWebKeycloakEnabled() ? undefined : JSON.stringify({ userId: DEV_CAREER_USER_ID });
}
