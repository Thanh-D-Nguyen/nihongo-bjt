// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { FlashcardInteractiveCard, type MentorLabels } from "./flashcard-interactive-card";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Flashcard review ratings", () => {
  it("passes easy unchanged to the SRS review callback", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const onRate = vi.fn();
    const mentor = new Proxy({}, { get: (_, key) => String(key) }) as MentorLabels;
    try {
      act(() => root.render(<FlashcardInteractiveCard answerContent="work" cardId="card-1" comebackContent={null} feedbackActive={false} frontText="仕事" imageNode={null} imageUploadNode={null} mentorLabels={mentor} onRate={onRate} onReveal={() => {}} phaseLabel="Answer" ratingLabels={{ again: "Again", hard: "Hard", good: "Good", easy: "Easy" }} reading={null} revealed revealLabel="Reveal" sessionReviewed={0} sessionTotal={1} />));
      const easy = [...host.querySelectorAll("button")].find(button => button.textContent === "Easy");
      expect(easy, "SRS review must expose easy rating").toBeDefined();
      act(() => { easy?.click(); vi.advanceTimersByTime(350); });
      expect(onRate).toHaveBeenCalledExactlyOnceWith("easy");
    } finally {
      act(() => root.unmount()); host.remove(); vi.clearAllTimers(); vi.useRealTimers();
    }
  });
});
