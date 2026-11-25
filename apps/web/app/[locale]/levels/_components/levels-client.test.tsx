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

import { LevelsClient } from "./levels-client";

const level = {
  code: "J5", nameVi: "J5 tiếng Việt", nameJa: "J5 日本語", nameEn: "J5 English",
  descriptionVi: "Mô tả tiếng Việt", descriptionJa: "日本語の説明", descriptionEn: "English description",
  scoreMin: 0, scoreMax: 199, jlptEquiv: "N5", color: "#22C55E",
  vocabCount: 2, kanjiCount: 3, grammarCount: 4, publishedLessonCount: 0
};

const labels = {
  vi: {
    title: "Trình độ BJT", subtitle: "Chọn trình độ", scoreRange: "Điểm", vocab: "Từ vựng", kanji: "Kanji",
    grammar: "Ngữ pháp", loading: "Đang tải", error: "Lỗi tải trình độ", readinessTitle: "Sẵn sàng thi thử",
    readinessSubtitle: "Theo kết quả gần đây", readinessCta: "Thi thử", assessmentIntro: "Làm bài đánh giá để bắt đầu.",
    assessmentCta: "Làm bài đánh giá", accuracyAcross: "độ chính xác qua {count} bài", noSessions: "Chưa có bài hoàn tất",
    analyticsError: "Không thể tải thống kê"
  },
  en: {
    title: "BJT levels", subtitle: "Choose a level", scoreRange: "Score", vocab: "Vocabulary", kanji: "Kanji",
    grammar: "Grammar", loading: "Loading", error: "Unable to load levels", readinessTitle: "Mock exam readiness",
    readinessSubtitle: "Based on recent performance", readinessCta: "Take mock exam", assessmentIntro: "Take an assessment to get started.",
    assessmentCta: "Take assessment", accuracyAcross: "accuracy across {count} sessions", noSessions: "No completed sessions yet",
    analyticsError: "Unable to load analytics"
  },
  ja: {
    title: "BJTレベル", subtitle: "レベルを選択", scoreRange: "スコア", vocab: "語彙", kanji: "漢字",
    grammar: "文法", loading: "読み込み中", error: "レベルを読み込めません", readinessTitle: "模擬試験の準備状況",
    readinessSubtitle: "最近の成績に基づく", readinessCta: "模擬試験を受ける", assessmentIntro: "診断テストを受けて学習を始めましょう。",
    assessmentCta: "診断テストを受ける", accuracyAcross: "{count}回の正答率", noSessions: "完了したセッションはまだありません",
    analyticsError: "分析を読み込めません"
  }
};

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  apiFetch.mockReset();
  apiFetch.mockImplementation((path: string) => path === "/api/levels"
    ? Promise.resolve(new Response(JSON.stringify([level, ...["J4", "J3", "J2", "J1", "J1+"].map((code) => ({ ...level, code }))])))
    : Promise.resolve(new Response(JSON.stringify({ totals: { bjtAccuracyPct: 82, completedBjtSessions: 2, reviewCount: 0, streakDays: 0 } }))));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("LevelsClient", () => {
 it("keeps lesson-only levels visible while hiding empty levels", async () => {
  const empty = { ...level, code: "J1+", vocabCount: 0, kanjiCount: 0, grammarCount: 0, publishedLessonCount: 0 };
  apiFetch.mockImplementation((path: string) => Promise.resolve(new Response(JSON.stringify(path === "/api/levels" ? [{ ...empty, publishedLessonCount: 1 }, { ...empty, code: "J0" }] : { totals: {} }))));
  await act(async () => root.render(<LevelsClient labels={labels.vi} locale="vi" />));
  expect({ lessonOnly: !!host.querySelector('a[href="/vi/levels/J1+"]'), empty: !!host.querySelector('a[href="/vi/levels/J0"]') }, "level availability follows public lessons and reference data").toEqual({ lessonOnly: true, empty: false });
  expect(host.textContent).toContain("Sắp ra mắt");
  expect(host.textContent).not.toContain("Từ vựng: 0");
 });
 it("hides levels with no available content", async () => {
  apiFetch.mockImplementation((path: string) => Promise.resolve(new Response(JSON.stringify(path === "/api/levels" ? [level, { ...level, code: "J1+", vocabCount: 0, kanjiCount: 0, grammarCount: 0 }] : { totals: {} }))));
  await act(async () => root.render(<LevelsClient labels={labels.vi} locale="vi" />));
  expect(host.querySelector('a[href="/vi/levels/J1+"]')).toBeNull();
 });
 it("renders each level code once per roadmap card when the API name already starts with the code", async () => {
  apiFetch.mockImplementation((path: string) => Promise.resolve(new Response(JSON.stringify(path === "/api/levels" ? [{ ...level, nameVi: "J5 — Sơ cấp" }] : { totals: {} }))));
  await act(async () => root.render(<LevelsClient labels={labels.vi} locale="vi" />));
  await act(async () => { await Promise.resolve(); });
  const card = host.querySelector('a[href="/vi/levels/J5"]');
  expect(card?.textContent?.match(/J5/g)?.length, "level code must render once per heading").toBe(1);
  expect(card?.textContent).toContain("Sơ cấp");
 });
	const renderLocale = async (locale: "vi" | "en" | "ja") => {
		await act(async () => root.render(<LevelsClient labels={labels[locale]} locale={locale} />));
		await act(async () => { await Promise.resolve(); });

    const name = { vi: level.nameVi, en: level.nameEn, ja: level.nameJa }[locale];
    const description = { vi: level.descriptionVi, en: level.descriptionEn, ja: level.descriptionJa }[locale];
    expect(host.textContent).toContain(name);
    expect(host.textContent).toContain(description);
    expect(host.querySelector('a[href="/' + locale + '/levels/J5"]')).not.toBeNull();
		expect(host.textContent).toContain(labels[locale].accuracyAcross.replace("{count}", "2"));
		expect(host.textContent).not.toContain("Take Assessment");
	};

	it("renders localized levels and actions for vi", () => renderLocale("vi"));
	it("renders localized levels and actions for en", () => renderLocale("en"));
	it("renders localized levels and actions for ja", () => renderLocale("ja"));

	const renderAssessmentPrompt = async (locale: "vi" | "en" | "ja") => {
		apiFetch.mockImplementation((path: string) => path === "/api/levels"
			? Promise.resolve(new Response(JSON.stringify([level])))
      : Promise.resolve(new Response(JSON.stringify({ totals: { bjtAccuracyPct: 0, completedBjtSessions: 0, reviewCount: 0, streakDays: 0 } }))));
    await act(async () => root.render(<LevelsClient labels={labels[locale]} locale={locale} />));
    await act(async () => { await Promise.resolve(); });

		expect(host.textContent).toContain(labels[locale].assessmentIntro);
		expect(host.textContent).toContain(labels[locale].assessmentCta);
		expect(host.textContent).toContain(labels[locale].noSessions);
	};

	for (const locale of ["vi", "en", "ja"] as const) {
		it(`localizes the assessment prompt when ${locale} has no sessions`, () => renderAssessmentPrompt(locale));
	}

  it("shows an analytics failure separately from empty learner history", async () => {
    apiFetch.mockImplementation((path: string) => path === "/api/levels"
      ? Promise.resolve(new Response(JSON.stringify([level])))
      : Promise.resolve(new Response("{}", { status: 500 })));
    await act(async () => root.render(<LevelsClient labels={labels.en} locale="en" />));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    expect(host.textContent).toContain(labels.en.analyticsError);
    expect(host.textContent).not.toContain(labels.en.noSessions);
    expect([...host.querySelectorAll('a[href="/en/quiz"]')].find((link) => link.textContent?.toLowerCase().includes("assessment"))).toBeUndefined();
  });

  it("hides the empty-history prompt when analytics fails", async () => {
    apiFetch.mockImplementation((path: string) => path === "/api/levels"
      ? Promise.resolve(new Response(JSON.stringify([level])))
      : Promise.resolve(new Response("{}", { status: 500 })));
    await act(async () => root.render(<LevelsClient labels={labels.en} locale="en" />));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

    expect(
      [...host.querySelectorAll('a[href="/en/quiz"]')].find((link) => link.textContent?.toLowerCase().includes("assessment")),
      "Empty-history CTA is shown after analytics failure"
    ).toBeUndefined();
  });

  it("uses dark-visible border-hover tokens on the roadmap timeline line and nodes", async () => {
    await act(async () => root.render(<LevelsClient labels={labels.vi} locale="vi" />));
    await act(async () => { await Promise.resolve(); });

    const track = host.querySelector(".roadmap-track");
    const line = track?.querySelector<HTMLElement>('[aria-hidden="true"]');
    expect(line?.className, "levels timeline connector must raise dark visibility via dark:bg-border-hover").toContain("dark:bg-border-hover");
    expect(line?.className).toContain("bg-border");

    const nodeCircle = track?.querySelector<HTMLElement>(".roadmap-node .rounded-full");
    expect(nodeCircle?.className, "levels timeline node must raise dark visibility via dark:border-border-hover").toContain("dark:border-border-hover");
    expect(nodeCircle?.className).toContain("border-border");
    expect(host.innerHTML, "levels client must not reference undefined --color-navy or --color-blue vars").not.toMatch(/--color-(?:navy|blue)\b/);
  });

  it("renders StudyTrackTabs with Lộ trình BJT active and navigation links to /scenarios and /news", async () => {
    await act(async () => root.render(<LevelsClient labels={labels.vi} locale="vi" />));
    await act(async () => { await Promise.resolve(); });

    const levelsTab = host.querySelector<HTMLAnchorElement>('a[href="/vi/levels"]');
    const scenariosTab = host.querySelector<HTMLAnchorElement>('a[href="/vi/scenarios"]');
    const readingTab = host.querySelector<HTMLAnchorElement>('a[href="/vi/news"]');

    expect(scenariosTab, "/levels must render StudyTrackTabs with link to /vi/scenarios").not.toBeNull();
    expect(readingTab, "/levels must render StudyTrackTabs with link to /vi/news").not.toBeNull();
    expect(levelsTab, "/levels must render active StudyTrackTabs link to /vi/levels").not.toBeNull();
    expect(levelsTab!.getAttribute("aria-current")).toBe("page");
    expect(scenariosTab!.getAttribute("aria-current")).toBeNull();
    expect(readingTab!.getAttribute("aria-current")).toBeNull();
    expect(levelsTab!.textContent?.trim()).toBe("Lộ trình BJT");
    expect(scenariosTab!.textContent?.trim()).toBe("Tình huống công sở");
    expect(readingTab!.textContent?.trim()).toBe("Đọc NHK");
  });

  it("renders a truthful neutral readiness empty state without an oversized dash or fake 0% when no sessions are completed", async () => {
    apiFetch.mockImplementation((path: string) => path === "/api/levels"
      ? Promise.resolve(new Response(JSON.stringify([level])))
      : Promise.resolve(new Response(JSON.stringify({ totals: { bjtAccuracyPct: 0, completedBjtSessions: 0, reviewCount: 0, streakDays: 0 } }))));

    await act(async () => root.render(<LevelsClient labels={labels.vi} locale="vi" />));
    await act(async () => { await Promise.resolve(); });

    const readinessHeading = Array.from(host.querySelectorAll("h3")).find(
      (heading) => heading.textContent?.trim() === labels.vi.readinessTitle
    );
    const readinessPanel = readinessHeading?.parentElement;
    expect(readinessPanel, "readiness panel must render").toBeTruthy();
    expect(readinessPanel?.textContent, "readiness panel must keep the neutral empty explanation").toContain(labels.vi.noSessions);
    expect(readinessPanel?.textContent, "readiness panel must not render a broken em-dash placeholder").not.toContain("—");
    expect(readinessPanel?.textContent, "readiness panel must not fake a 0% readiness score").not.toContain("0%");
    expect(readinessPanel?.querySelector(".text-4xl"), "readiness panel must not show an oversized metric block when empty").toBeNull();
    expect(readinessPanel?.querySelector('a[href="/vi/quiz"]')?.textContent?.trim()).toBe(labels.vi.readinessCta);
  });
});
