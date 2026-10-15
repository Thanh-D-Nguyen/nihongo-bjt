// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { LessonDetailClient } from "./lesson-detail-client";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("../../../../../../../lib/learner-api", () => ({
	learnerApiFetchOptional: apiFetch
}));
vi.mock("@/app/[locale]/quiz/_components/bjt-audio-player", () => ({
	cancelJapaneseSpeechSynthesis: vi.fn(),
	speakJapaneseWithBrowserTts: vi.fn()
}));
vi.mock("../../../../../grammar/_components/grammar-rich-text", () => ({
	GrammarRichText: ({ text }: { text: string }) => text,
	grammarTextPreview: (text: string) => text
}));
vi.mock("next/link", () => ({
	default: ({ children, href, ...props }: { children: ReactNode; href: string }) =>
		createElement("a", { href, ...props }, children)
}));

type Props = Parameters<typeof LessonDetailClient>[0];

const labels = Object.fromEntries(
	[
		"pageTitle", "backToLevel", "vocabSection", "kanjiSection", "grammarSection", "notFound",
		"loading", "error", "meaningLabel", "readingLabel", "examplesLabel", "nextLesson", "prevLesson",
		"practiceQuiz", "itemsInLesson", "breadcrumbLevels", "collapseSection", "expandSection", "completed",
		"markComplete", "close", "posLabel", "onyomiLabel", "kunyomiLabel", "weekLabel", "durationLabel",
		"minutesLabel", "lessonType", "reviewType", "checkpointType", "objectivesSection", "scenarioSection",
		"knowledgeSection", "vocabularyFocusSection", "grammarFocusSection", "examplesSection", "practiceSection",
		"summarySection", "nuanceSection", "commonMistakesSection", "checkAnswer", "correctAnswer",
		"incorrectAnswer", "chooseAnswer", "explanationLabel", "audioUnavailable", "audioTtsReady",
		"audioGeneratedReady", "playAudio", "stopAudio", "audioPlaybackError", "loginToSave", "savingProgress",
		"progressError", "activitiesLabel"
	].map((key) => [key, key])
) as unknown as Props["labels"];

const lesson = {
	id: "lesson-id",
	slug: "lesson-test",
	levelCode: "J1",
	sortOrder: 1,
	titleVi: "Bài học thử",
	titleJa: "テストレッスン",
	descriptionVi: null,
	descriptionJa: null,
	weekNumber: 1,
	unitType: "lesson" as const,
	unitOrder: 1,
	estimatedDurationMin: 20,
	difficulty: "foundation",
	skillTags: [],
	businessTopics: [],
	contentVersion: "test",
	lessonContent: { schemaVersion: "" },
	prevLesson: null,
	nextLesson: null,
	contents: [],
	isCompleted: false,
	canSaveProgress: true
};

function response(data: unknown, ok = true): Response {
	return new Response(JSON.stringify(data), { status: ok ? 200 : 500 });
}

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	host = document.createElement("div");
	document.body.appendChild(host);
	root = createRoot(host);
});

afterEach(async () => {
	await act(async () => root.unmount());
	host.remove();
	vi.unstubAllGlobals();
});

async function renderLesson(canSaveProgress = true) {
	await act(async () => {
		root.render(<LessonDetailClient slug={lesson.slug} levelCode="J1" labels={labels} locale="vi" />);
	});
	await act(async () => { await Promise.resolve(); });
	if (!canSaveProgress) expect(host.querySelector("a[href^='/vi/login']")).toBeTruthy();
}

describe("LessonDetailClient", () => {
	beforeEach(() => {
		apiFetch.mockReset();
	});

	it("persists completion through the authenticated API and restores server state", async () => {
		apiFetch.mockResolvedValueOnce(response(lesson)).mockResolvedValueOnce(response({ isCompleted: true }));
		await renderLesson();

		await act(async () => {
			host.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});

		expect(apiFetch).toHaveBeenCalledWith(
			"/api/levels/lessons/lesson-test/progress",
			expect.objectContaining({ method: "PUT", body: JSON.stringify({ completed: true }) })
		);
		expect(host.querySelector("button")?.textContent).toContain("completed");
	});

	it("sends anonymous learners to login before saving progress", async () => {
		apiFetch.mockResolvedValueOnce(response({ ...lesson, canSaveProgress: false }));
		await renderLesson(false);

		const link = host.querySelector("a[href^='/vi/login']");
		expect(link?.getAttribute("href")).toBe("/vi/login?returnTo=%2Fvi%2Flevels%2FJ1%2Flessons%2Flesson-test");
	});
});
