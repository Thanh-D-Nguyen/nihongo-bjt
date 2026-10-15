// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("../../../../../lib/learner-api", () => ({ learnerApiFetchOptional: apiFetch }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) =>
    createElement("a", { href, ...props }, children)
}));

import { LevelDetailClient } from "./level-detail-client";

const labels = {
  back: "back", tabVocabulary: "Vocabulary", tabKanji: "Kanji", tabGrammar: "Grammar", tabLessons: "Lessons",
  searchPlaceholder: "Search", noResults: "No results", loading: "Loading", notFound: "Not found", error: "Error",
  loadMore: "Load more", practiceQuiz: "Practice", lessonLabel: "Lesson", vocabShort: "Words", grammarShort: "Grammar",
  kanjiShort: "Kanji", noLessons: "No lessons", lessonCompleted: "Completed", lessonProgress: "{done} of {total}",
  weekLabel: "Week", mainLessonLabel: "Lesson", reviewUnitLabel: "Review", checkpointUnitLabel: "Checkpoint",
  minutesLabel: "minutes", activitiesLabel: "activities"
};

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  apiFetch.mockReset();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("LevelDetailClient", () => {
  it("shows canonical reference counts and persisted lesson completion", async () => {
    apiFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        code: "J1", nameJa: "J1", nameVi: "Cao cấp", scoreMin: 530, scoreMax: 599, jlptEquiv: "N1",
        descriptionVi: "description", descriptionJa: "説明", color: "#EF4444", vocabCount: 2832, kanjiCount: 1234, grammarCount: 361
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        id: "lesson-id", slug: "lesson", sortOrder: 1, titleVi: "Bài học", titleJa: "レッスン", descriptionVi: null,
        descriptionJa: null, weekNumber: 1, unitType: "lesson", unitOrder: 1, estimatedDurationMin: 20,
        activityCount: 2, vocabCount: 0, kanjiCount: 0, grammarCount: 0, isCompleted: true
      }])));

    await act(async () => {
      root.render(<LevelDetailClient code="J1" labels={labels} locale="vi" />);
    });
    await act(async () => { await Promise.resolve(); });

    expect(host.textContent).toContain("2832");
    expect(host.textContent).toContain("1234");
    expect(host.textContent).toContain("361");
    expect(host.textContent).toContain("1 of 1");
    expect(host.querySelector("ol li a")?.className).toContain("bg-[#F0FDF4]");
  });
});
