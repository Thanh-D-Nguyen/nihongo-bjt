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
});
