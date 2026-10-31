// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FLASHCARD_THEME_DEFINITIONS } from "@nihongo-bjt/shared";

import { DeckStudySession, type DeckStudySessionLabels } from "./deck-study-session";

const { recordProgress } = vi.hoisted(() => ({ recordProgress: vi.fn() }));
vi.mock("../../../_hooks/use-study-progress", () => ({ recordStudyProgress: recordProgress }));
vi.mock("../../../_components/battle-bot-avatar", () => ({ BattleBotAvatar: () => null }));

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
  it("loads relative media URLs from the learner API origin", () => {
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const path = "/api/media/test/private-preview";
    act(() => root.render(<DeckStudySession cards={[{ id: "card", frontText: "仕事", backText: "work", reading: null, primaryImage: { assetId: "test", mimeType: "image/jpeg", readUrl: path } }]} labels={labels} />));
    const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/u, "");
    expect(host.querySelector("img")?.getAttribute("src")).toBe(`${base}${path}`);
    act(() => root.unmount());
  });
  it("shows safe image attribution on both faces and omits absent credits", () => {
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const image = {
      assetId: "image-1",
      mimeType: "image/jpeg",
      readUrl: "https://example.com/image.jpg",
      provider: "Unsplash",
      sourceUrl: "https://example.com/source",
      author: "Alice",
      authorUrl: "https://example.com/alice",
      license: "CC BY",
      licenseUrl: "https://example.com/license"
    };
    const card = { id: "card", frontText: "仕事", backText: "work", reading: null };
    act(() =>
      root.render(<DeckStudySession cards={[{ ...card, primaryImage: image }]} labels={labels} />)
    );
    const faces = host.querySelectorAll<HTMLElement>(
      ".fc-card-shell .flashcard-theme-surface[aria-hidden]"
    );
    for (const face of faces) {
      expect(face.textContent).toContain("Unsplash");
      for (const [text, href] of [
        ["Unsplash", image.sourceUrl],
        ["Alice", image.authorUrl],
        ["CC BY", image.licenseUrl]
      ]) {
        const link = [...face.querySelectorAll("a")].find((item) => item.textContent === text);
        expect(link?.getAttribute("href")).toBe(href);
        expect(link?.getAttribute("rel")).toContain("noopener");
      }
    }
    act(() =>
      root.render(
        <DeckStudySession
          cards={[
            {
              ...card,
              primaryImage: {
                ...image,
                sourceUrl: "javascript:alert(1)",
                authorUrl: "//evil.example",
                licenseUrl: "data:text/html,hi"
              }
            }
          ]}
          labels={labels}
        />
      )
    );
    expect(
      host.querySelectorAll('a[href^="javascript:"], a[href^="//"], a[href^="data:"]')
    ).toHaveLength(0);
    expect(host.textContent).toContain("Alice");
    act(() =>
      root.render(
        <DeckStudySession
          cards={[
            {
              ...card,
              primaryImage: { assetId: "image-1", mimeType: "image/jpeg", readUrl: image.readUrl }
            }
          ]}
          labels={labels}
        />
      )
    );
    expect(host.textContent).not.toContain("Unsplash");
    expect(host.querySelectorAll("figcaption")).toHaveLength(0);
    act(() => root.unmount());
  });
  it("keeps four preview ratings local and explains that SRS progress is not saved", () => {
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <DeckStudySession
          cards={[{ id: "preview", frontText: "仕事", backText: "work", reading: null }]}
          deckId="preview"
          labels={labels}
        />
      )
    );
    expect(host.textContent).toContain("deckStudyModeNote");
    act(() =>
      host?.querySelector<HTMLButtonElement>(".fc-card-shell > button[aria-pressed]")?.click()
    );
    const easy = [...host.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("deckStudyRateEasy")
    );
    expect(easy, "preview must expose easy rating").toBeDefined();
    act(() => easy?.click());
    expect(host.textContent).toContain("deckStudyComplete");
    expect(recordProgress).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

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
    expect(front?.className).toContain("flashcard-study-term");
    expect(back?.className).toContain("flashcard-study-answer");
    expect(reading?.className).toContain("flashcard-study-reading");
    expect(reading?.className).toContain("text-center");

    const toolButtons = studyHeader?.querySelectorAll<HTMLButtonElement>('[role="toolbar"] button');
    expect(toolButtons).toHaveLength(4);
    toolButtons?.forEach((button) => {
      expect(button.getAttribute("aria-label")).toBeTruthy();
      expect(button.textContent?.trim()).toBeTruthy();
    });

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
