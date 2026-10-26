// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("../../../../lib/learner-api", () => ({ learnerApiFetchOptional: apiFetch }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) =>
    createElement("a", { href, ...props }, children)
}));

import { BjtLevelsSection } from "./bjt-levels-section";

const labels = { sectionTitle: "BJT", viewAll: "See all", vocab: "Words", kanji: "Kanji", grammar: "Grammar", error: "Roadmap unavailable" };
const levels = [{
  code: "J5", nameVi: "J5 tiếng Việt", nameJa: "J5 日本語", nameEn: "J5 English", color: "#22C55E",
  vocabCount: 2, kanjiCount: 3, grammarCount: 4, publishedLessonCount: 0
}];

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  apiFetch.mockReset();
  apiFetch.mockResolvedValue(new Response(JSON.stringify(levels)));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("BjtLevelsSection", () => {
  it("keeps lesson-only levels visible while hiding empty levels", async () => {
    const empty = { ...levels[0], code: "J1+", vocabCount: 0, kanjiCount: 0, grammarCount: 0, publishedLessonCount: 0 };
    apiFetch.mockResolvedValue(new Response(JSON.stringify([{ ...empty, publishedLessonCount: 1 }, { ...empty, code: "J0" }])));
    await act(async () => root.render(<BjtLevelsSection labels={labels} locale="en" />));
    expect({ lessonOnly: !!host.querySelector('a[href="/en/levels/J1+"]'), empty: !!host.querySelector('a[href="/en/levels/J0"]') }, "level availability follows public lessons and reference data").toEqual({ lessonOnly: true, empty: false });
  });
  it("hides levels without published content", async () => {
    apiFetch.mockResolvedValue(new Response(JSON.stringify([...levels, { ...levels[0], code: "J1+", vocabCount: 0, kanjiCount: 0, grammarCount: 0 }])));
    await act(async () => root.render(<BjtLevelsSection labels={labels} locale="en" />));
    expect(host.querySelector('a[href="/en/levels/J1+"]')).toBeNull();
    expect(host.querySelector('a[href="/en/levels/J5"]')).not.toBeNull();
  });
  it("loads the shared collection and uses the selected locale", async () => {
    await act(async () => root.render(<BjtLevelsSection labels={labels} locale="en" />));
    await act(async () => { await Promise.resolve(); });

    expect(apiFetch).toHaveBeenCalledWith("/api/levels");
    expect(host.textContent).toContain("J5 English");
    expect(host.querySelector('a[href="/en/levels/J5"]')).not.toBeNull();
  });

  it("shows a localized message if the public collection fails", async () => {
    apiFetch.mockResolvedValue(new Response("{}", { status: 503 }));
    await act(async () => root.render(<BjtLevelsSection labels={labels} locale="en" />));
    await act(async () => { await Promise.resolve(); });

    expect(host.textContent).toContain(labels.error);
  });
});
