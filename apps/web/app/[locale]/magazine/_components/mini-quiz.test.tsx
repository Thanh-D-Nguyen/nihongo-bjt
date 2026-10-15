// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MiniQuiz } from "./mini-quiz";

const copy = {
  quizProgress: "Question {current}/{total}", quizNext: "Next", quizResult: "See results",
  quizComplete: "Complete", quizScore: "Score: {score}/{total}", quizPerfect: "Perfect",
  quizGood: "Good", quizTryAgain: "Try again", quizSaveFailed: "Could not save your result.",
};
const quizzes = [{ questionJp: "会議の読み方は？", options: [{ label: "かいぎ", isCorrect: true }] }];
let root: Root;
let container: HTMLDivElement;
const fetchMock = vi.fn();

async function clickButton(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent?.includes(label));
  if (!button) throw new Error(`button not found: ${label}`);
  await act(async () => button.click());
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("magazine mini quiz", () => {
  it("saves the result through the same-origin API and reports a failed save", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
    await act(async () => root.render(<MiniQuiz quizzes={quizzes} articleSlug="phrase/article" t={copy} />));
    await clickButton("かいぎ");
    await clickButton(copy.quizResult);

    expect(fetchMock).toHaveBeenCalledWith("/api/magazine/phrase%2Farticle/read", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ quizScore: 1, quizTotal: 1 }),
    }));
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(copy.quizSaveFailed);
  });
});
