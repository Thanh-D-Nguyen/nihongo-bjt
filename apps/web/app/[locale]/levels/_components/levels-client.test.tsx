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
 });
 it("hides levels with no available content", async () => {
  apiFetch.mockImplementation((path: string) => Promise.resolve(new Response(JSON.stringify(path === "/api/levels" ? [level, { ...level, code: "J1+", vocabCount: 0, kanjiCount: 0, grammarCount: 0 }] : { totals: {} }))));
  await act(async () => root.render(<LevelsClient labels={labels.vi} locale="vi" />));
  expect(host.querySelector('a[href="/vi/levels/J1+"]')).toBeNull();
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
});
