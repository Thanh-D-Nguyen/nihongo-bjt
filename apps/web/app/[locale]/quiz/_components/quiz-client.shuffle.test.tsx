// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import viMessages from "../../../../messages/vi.json";
import { QuizQuestionPanel } from "./quiz-client";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  vi.useRealTimers();
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  host?.remove();
  host = null;
});

describe("QuizQuestionPanel shuffled option display and key submission", () => {
  it("renders positional A/B/C/D badges while submitting canonical optionKey on click and keyboard shortcut", async () => {
    vi.useFakeTimers();
    const onAnswer = vi.fn();
    const question = {
      question: {
        id: "q-shuffled-1",
        prompt: "適切な表現を選んでください。",
        skillTag: "keigo",
        options: [
          { optionKey: "C", text: "選択肢C" },
          { optionKey: "A", text: "選択肢A" },
          { optionKey: "D", text: "選択肢D" },
          { optionKey: "B", text: "選択肢B（正解）" }
        ]
      },
      session: {
        id: "sess-shuffled-1",
        status: "active",
        totalQuestions: 4,
        currentQuestionNo: 0,
        correctCount: 0,
        estimatedScore: null,
        estimatedBjtBand: null,
        testType: "practice"
      }
    };

    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root!.render(
        <QuizQuestionPanel
          flagged={false}
          labels={viMessages.quiz}
          onAnswer={onAnswer}
          onToggleFlag={() => undefined}
          question={question}
          readingAssistMode="off"
          userId="11111111-1111-4111-8111-111111111111"
        />
      );
    });

    const optionButtons = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).filter(
      (btn) => btn.textContent?.includes("選択肢")
    );
    expect(optionButtons).toHaveLength(4);

    // Visual badges must be positional A/B/C/D, not raw shuffled keys C/A/D/B.
    const badges = optionButtons.map((btn) => btn.querySelector("span > span")?.textContent?.trim());
    expect(badges).toEqual(["A", "B", "C", "D"]);

    // Clicking the fourth visual option (badge D) must submit its canonical optionKey ("B").
    await act(async () => {
      optionButtons[3]?.click();
      vi.advanceTimersByTime(300);
    });
    expect(onAnswer).toHaveBeenCalledWith("B", undefined);

    // Remount fresh and verify keyboard shortcuts align with positional badges A/B/C/D.
    onAnswer.mockReset();
    act(() => root?.unmount());
    root = createRoot(host);
    await act(async () => {
      root!.render(
        <QuizQuestionPanel
          flagged={false}
          labels={viMessages.quiz}
          onAnswer={onAnswer}
          onToggleFlag={() => undefined}
          question={question}
          readingAssistMode="off"
          userId="11111111-1111-4111-8111-111111111111"
        />
      );
    });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }));
      vi.advanceTimersByTime(300);
    });
    expect(onAnswer).toHaveBeenCalledWith("B", undefined);

    onAnswer.mockReset();
    act(() => root?.unmount());
    root = createRoot(host);
    await act(async () => {
      root!.render(
        <QuizQuestionPanel
          flagged={false}
          labels={viMessages.quiz}
          onAnswer={onAnswer}
          onToggleFlag={() => undefined}
          question={question}
          readingAssistMode="off"
          userId="11111111-1111-4111-8111-111111111111"
        />
      );
    });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
      vi.advanceTimersByTime(300);
    });
    expect(onAnswer).toHaveBeenCalledWith("C", undefined);
  });
});
