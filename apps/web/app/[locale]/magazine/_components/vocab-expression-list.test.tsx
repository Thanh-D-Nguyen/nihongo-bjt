// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../../../../lib/go-auth-provider", () => ({ useGoAuth: () => ({ userId: "learner-1" }) }));
vi.mock("../../../../lib/learner-api", () => ({ learnerApiFetch: (...args: unknown[]) => api.fetch(...args) }));

import { VocabExpressionList } from "../../_components/vocab-expression-list";

let root: Root;
let container: HTMLDivElement;
const flashcardLabels = {
  addFlashcard: "Add flashcard", addedFlashcard: "Added", bookmark: "", bookmarked: "",
  signInHint: "Sign in", chooseDeck: "Choose a deck", createDeck: "Create deck",
  newDeckPlaceholder: "Deck name", nDecks: "No decks",
};

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  api.fetch.mockReset();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("vocabulary flashcard action", () => {
  it("persists the selected magazine vocabulary to the learner's deck", async () => {
    api.fetch
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: "public-deck", ownerUserId: null, titleVi: "Public deck", visibility: "public", _count: { cards: 1 } },
        { id: "deck-1", ownerUserId: "learner-1", titleVi: "BJT", _count: { cards: 0 } },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }));
    await act(async () => root.render(<VocabExpressionList
      expressions={[{ word: "会議", reading: "かいぎ", meaning: "Cuộc họp", sourceId: "vocab-row-1" }]}
      gradient="from-indigo-500 to-purple-600"
      labels={{ addToFlashcard: "Add", addedToFlashcard: "Added", example: "Example", exampleMeaning: "Meaning", listenPronunciation: "Listen", meaning: "Meaning", reading: "Reading", tapToExpand: "Expand", usageNote: "Note" }}
      flashcardLabels={flashcardLabels}
    />));
    await act(async () => container.querySelector("button")?.click());
    const addButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Add flashcard"));
    await act(async () => addButton?.click());
    expect(container.textContent).not.toContain("Public deck");
    const deckButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("BJT"));
    await act(async () => deckButton?.click());

    expect(api.fetch).toHaveBeenLastCalledWith("/api/flashcards/cards/from-content", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ userId: "learner-1", deckId: "deck-1", sourceId: "vocab-row-1", sourceType: "magazine_vocab", frontText: "会議", backText: "Cuộc họp", reading: "かいぎ" }),
    }));
    expect(container.textContent).toContain("Added");
  });

  it("uses app theme tokens without hardcoded Tailwind palette classes across expanded expression cards", async () => {
    await act(async () => root.render(<VocabExpressionList
      expressions={[{
        word: "折衝",
        reading: "せっしょう",
        meaning: "Đàm phán, thương lượng",
        jlptLevel: "N1",
        example: "取引先と条件について折衝する。",
        exampleReading: "とりひきさきとじょうけんについてせっしょうする。",
        exampleMeaning: "Đàm phán về điều kiện với đối tác.",
        usageNote: "Dùng trong bối cảnh đàm phán chính thức giữa hai tổ chức.",
        sourceId: "vocab-row-2",
      }]}
      gradient="from-action to-action-hover"
      labels={{
        addToFlashcard: "Add",
        addedToFlashcard: "Added",
        example: "Example",
        exampleMeaning: "Meaning",
        listenPronunciation: "Listen",
        meaning: "Meaning",
        reading: "Reading",
        tapToExpand: "Expand",
        usageNote: "Usage note",
      }}
      flashcardLabels={flashcardLabels}
    />));

    await act(async () => container.querySelector("button")?.click());

    const hardcodedPalette = /(?<![\w:-])(?:bg|text|border|ring|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\/\d+)?(?![\w-])|(?<![\w:-])bg-white(?![\w/-])/;
    const violations = Array.from(container.querySelectorAll("*"))
      .map((el) => {
        const cls = typeof el.className === "string" ? el.className : el.getAttribute("class") ?? "";
        const match = cls.match(hardcodedPalette);
        return match ? `${el.tagName.toLowerCase()}: ${match[0]}` : null;
      })
      .filter((item): item is string => item !== null);
    expect(violations, "vocab-expression-list must use app theme tokens instead of hardcoded Tailwind palette classes").toEqual([]);

    const readingChip = Array.from(container.querySelectorAll("span")).find((el) => el.textContent === "せっしょう");
    expect(readingChip?.className).toContain("bg-leaf-soft");
    expect(readingChip?.className).toContain("text-leaf-strong");

    const speakButton = Array.from(container.querySelectorAll("button")).find((el) => el.textContent?.includes("Listen"));
    expect(speakButton?.className).toContain("bg-accent-soft");
    expect(speakButton?.className).toContain("text-brand-accent");

    const usageBody = Array.from(container.querySelectorAll("p")).find((el) => el.textContent?.includes("bối cảnh đàm phán"));
    expect(usageBody?.className).toContain("text-amber-strong");
    const usageBox = usageBody?.closest("div")?.parentElement;
    expect(usageBox?.className).toContain("bg-amber-soft");
    expect(usageBox?.className).toContain("border-amber/30");

    const exampleText = Array.from(container.querySelectorAll("p")).find((el) => el.textContent?.includes("取引先と条件について折衝する"));
    expect(exampleText?.className).toContain("text-ink");
    expect(exampleText?.parentElement?.className).toContain("bg-paper");
    expect(exampleText?.parentElement?.className).toContain("border-border");
  });
});
