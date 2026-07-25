// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { FLASHCARD_THEME_DEFINITIONS } from "@nihongo-bjt/shared";

import { DeckStudySession, type DeckStudySessionLabels } from "./deck-study-session";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const labels = new Proxy<Record<string, string>>(
  {},
  { get: (_target, property) => String(property) }
) as DeckStudySessionLabels;

const longJapanese =
  "会議の目的と現在の課題を関係者全員で共有したうえで、実行可能な改善策を優先順位とともに提案してください。";
const longVietnamese =
  "Sau khi chia sẻ mục tiêu của cuộc họp và các vấn đề hiện tại với tất cả bên liên quan, hãy đề xuất các phương án cải thiện khả thi kèm theo thứ tự ưu tiên rõ ràng.";

let host: HTMLDivElement | null = null;

afterEach(() => {
  host?.remove();
  host = null;
});

describe("DeckStudySession semantic theme rendering", () => {
  it("uses theme foreground on both faces, keeps long ja/vi content, and preserves flip focus", () => {
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const theme = FLASHCARD_THEME_DEFINITIONS[3].config;

    act(() => {
      root.render(
        <DeckStudySession
          cards={[
            {
              backText: longVietnamese,
              frontText: longJapanese,
              id: "card-1",
              reading: "かいぎのもくてきとかだいをきょうゆうする"
            }
          ]}
          deckId="deck-1"
          labels={labels}
          styleConfig={theme}
        />
      );
    });

    const themedRoot = host.querySelector<HTMLElement>(".fc-card-shell.flashcard-theme-surface");
    expect(themedRoot?.style.getPropertyValue("--flashcard-foreground")).toBe(theme.foreground);

    const studyHeader = host.querySelector<HTMLElement>('[data-testid="deck-study-header"]');
    const modeButtons = studyHeader?.querySelectorAll<HTMLButtonElement>(
      '[role="group"] button[aria-pressed]'
    );
    expect(modeButtons).toHaveLength(3);
    expect(modeButtons?.[0].getAttribute("aria-pressed")).toBe("true");
    expect(modeButtons?.[1].getAttribute("aria-pressed")).toBe("false");

    const contentSurface = host.querySelector<HTMLElement>(
      '[data-testid="deck-study-card-content"]'
    );
    expect(contentSurface?.className).toContain("flex-1");

    const front = host.querySelector<HTMLElement>(".flashcard-theme-primary");
    const back = host.querySelector<HTMLElement>(".flashcard-theme-answer");
    const reading = front?.parentElement?.querySelector<HTMLElement>('[lang="ja"]:last-child');
    expect(front?.textContent).toContain(longJapanese);
    expect(back?.textContent).toContain(longVietnamese);
    expect(front?.className).not.toMatch(/truncate|line-clamp|ellipsis/);
    expect(back?.className).not.toMatch(/truncate|line-clamp|ellipsis/);
    expect(reading?.className).toContain("text-center");

    const flipButton = host.querySelector<HTMLButtonElement>(
      ".fc-card-shell > button[aria-pressed]"
    );
    expect(flipButton).not.toBeNull();
    flipButton?.focus();
    act(() => flipButton?.click());
    expect(flipButton?.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(flipButton);

    const faces = host.querySelectorAll<HTMLElement>(
      ".fc-card-shell .flashcard-theme-surface[aria-hidden]"
    );
    expect(faces[0].getAttribute("aria-hidden")).toBe("true");
    expect(faces[1].getAttribute("aria-hidden")).toBe("false");

    act(() => root.unmount());
  });
});
