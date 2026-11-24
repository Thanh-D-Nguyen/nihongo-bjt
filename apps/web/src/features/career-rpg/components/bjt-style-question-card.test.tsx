// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../../messages/vi.json";
import type { BjtStyleQuestion } from "../types";
import { BjtStyleQuestionCard } from "./bjt-style-question-card";

const { act } = React;

const sampleQuestion: BjtStyleQuestion = {
  id: "q-dark-contrast-1",
  promptJa: "部長に会議の日程変更を伝えるとき、最も適切な表現はどれですか。",
  promptVi: "Khi báo cho trưởng phòng về việc đổi lịch họp, cách nói nào phù hợp nhất?",
  skillTag: "keigo",
  difficulty: "standard",
  options: [
    {
      optionKey: "A",
      textJa: "会議の予定を変えました。",
      isCorrect: false,
      outcome: {
        trustDelta: -1,
        clarityScore: 2,
        politenessScore: 1,
        businessRiskDelta: 1,
        satisfactionDelta: -1,
        nextActionCorrect: false,
        npcReactionTag: "frown",
        consequenceJa: "少しぶっきらぼうに聞こえました。",
        consequenceVi: "Nghe hơi cộc lốc.",
        affectedNpcSlug: "npc.buchou",
        errorType: "keigo_misunderstanding"
      }
    },
    {
      optionKey: "B",
      textJa: "恐れ入りますが、会議の日程を変更させていただいてもよろしいでしょうか。",
      isCorrect: true,
      outcome: {
        trustDelta: 2,
        clarityScore: 3,
        politenessScore: 3,
        businessRiskDelta: -1,
        satisfactionDelta: 2,
        nextActionCorrect: true,
        npcReactionTag: "nod",
        consequenceJa: "丁寧な依頼として受け止められました。",
        consequenceVi: "Được tiếp nhận như một lời đề nghị lịch sự.",
        affectedNpcSlug: "npc.buchou",
        errorType: null
      }
    }
  ]
};

describe("BjtStyleQuestionCard", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("uses theme tokens for picked and unpicked states with no hardcoded light hex colors", async () => {
    const onSubmit = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <BjtStyleQuestionCard
          labels={messages.careerRpg.chapter}
          onSubmit={onSubmit}
          question={sampleQuestion}
        />
      );
    });

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button[type="button"]'));
    expect(buttons).toHaveLength(2);

    const [optionA, optionB] = buttons;
    expect(optionA.getAttribute("aria-pressed")).toBe("false");
    expect(optionA.className).toContain("bg-surface");
    expect(optionA.className).toContain("border-border");
    expect(optionA.className).not.toContain("bg-white");

    const badgeA = optionA.querySelector("span");
    expect(badgeA?.className).toContain("bg-paper");
    expect(badgeA?.className).toContain("text-muted");

    await act(async () => {
      optionB.click();
    });

    expect(optionB.getAttribute("aria-pressed")).toBe("true");
    expect(optionB.className).toContain("bg-accent-soft");
    expect(optionB.className).toContain("border-brand-navy");
    expect(optionB.className).not.toContain("#EEF2FF");
    expect(optionB.className).not.toContain("#1B2A4A");

    const badgeB = optionB.querySelector("span");
    expect(badgeB?.className).toContain("bg-brand-panel");
    expect(badgeB?.className).toContain("text-white");

    const textB = optionB.querySelectorAll("span")[1];
    expect(textB?.className).toContain("text-ink");
    expect(textB?.className).not.toContain("#111827");

    const submitButton = container.querySelector('button:not([type="button"])') as HTMLButtonElement | null;
    expect(submitButton?.disabled).toBe(false);
    await act(async () => {
      submitButton?.click();
    });
    expect(onSubmit).toHaveBeenCalledWith("B");

    await act(async () => root.unmount());
  });
});
