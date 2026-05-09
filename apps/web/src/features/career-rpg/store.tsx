"use client";

/**
 * Career RPG client store — keeps a copy of mock state in localStorage so
 * UI changes (rank XP, NPC trust, inbox) survive route navigation during the
 * visual prototype. Replace with real fetch + mutation hooks later.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode
} from "react";

import { mockBundle } from "./mock-data";
import type {
  CareerRpgMockBundle,
  ChapterResult,
  ContextMemo,
  NpcRelation,
  SkillAxisCode,
  UserCareerState
} from "./types";

const STORAGE_KEY = "career-rpg.snapshot.v1";

interface State {
  career: UserCareerState;
  npcRelations: NpcRelation[];
  inbox: ContextMemo[];
  hydrated: boolean;
}

type Action =
  | { type: "APPLY_CHAPTER_RESULT"; result: ChapterResult }
  | { type: "HYDRATE"; snapshot: Omit<State, "hydrated"> }
  | { type: "RESET" };

function initialState(bundle: CareerRpgMockBundle): State {
  return {
    career: bundle.state,
    npcRelations: bundle.npcRelations,
    inbox: bundle.inbox,
    hydrated: false
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "APPLY_CHAPTER_RESULT": {
      const { rankXpDelta, skillDeltas, npcTrustDeltas, contextMemoIds } = action.result;
      const career: UserCareerState = {
        ...state.career,
        rankXp: state.career.rankXp + rankXpDelta,
        skills: state.career.skills.map((s) => {
          const delta = skillDeltas[s.axisCode as SkillAxisCode];
          return delta ? { ...s, value: Math.min(100, s.value + delta) } : s;
        })
      };
      const npcRelations = state.npcRelations.map((r) => {
        const hit = npcTrustDeltas.find((d) => d.npcSlug === r.npcSlug);
        if (!hit) return r;
        return {
          ...r,
          trustScore: Math.max(0, Math.min(100, r.trustScore + hit.delta)),
          lastInteractionAt: action.result.completedAt
        };
      });
      const newMemos = mockBundle.inbox.filter((m) => contextMemoIds.includes(m.id));
      const existingIds = new Set(state.inbox.map((m) => m.id));
      const merged = [
        ...newMemos
          .filter((m) => !existingIds.has(m.id))
          .map((m) => ({ ...m, status: "unread" as const })),
        ...state.inbox
      ];
      return { ...state, career, npcRelations, inbox: merged };
    }
    case "HYDRATE":
      return { ...action.snapshot, hydrated: true };
    case "RESET":
      return { ...initialState(mockBundle), hydrated: true };
    default:
      return state;
  }
}

interface CareerRpgContextValue extends State {
  applyChapterResult: (result: ChapterResult) => void;
  reset: () => void;
}

const CareerRpgContext = createContext<CareerRpgContextValue | null>(null);

export function CareerRpgProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, mockBundle, initialState);

  // Hydrate from localStorage on first mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Omit<State, "hydrated">;
        if (parsed?.career && Array.isArray(parsed.npcRelations) && Array.isArray(parsed.inbox)) {
          dispatch({ type: "HYDRATE", snapshot: parsed });
          return;
        }
      }
    } catch {
      // Corrupt cache — ignore.
    }
    dispatch({ type: "HYDRATE", snapshot: initialState(mockBundle) });
  }, []);

  // Persist on every change once hydrated (avoid clobbering with default).
  useEffect(() => {
    if (typeof window === "undefined" || !state.hydrated) return;
    try {
      const { hydrated: _h, ...persisted } = state;
      void _h;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // Quota exceeded or disabled — silently ignore for prototype.
    }
  }, [state]);

  const applyChapterResult = useCallback(
    (result: ChapterResult) => dispatch({ type: "APPLY_CHAPTER_RESULT", result }),
    []
  );
  const reset = useCallback(() => {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    dispatch({ type: "RESET" });
  }, []);

  const value = useMemo(
    () => ({ ...state, applyChapterResult, reset }),
    [state, applyChapterResult, reset]
  );

  return <CareerRpgContext.Provider value={value}>{children}</CareerRpgContext.Provider>;
}

export function useCareerRpg(): CareerRpgContextValue {
  const ctx = useContext(CareerRpgContext);
  if (!ctx) {
    throw new Error("useCareerRpg must be used inside <CareerRpgProvider>.");
  }
  return ctx;
}
