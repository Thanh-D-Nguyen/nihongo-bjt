// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const { act } = React;
const auth = vi.hoisted(() => ({ userId: "learner-test" }));
const learnerApiFetch = vi.hoisted(() => vi.fn());
vi.mock("../../../../../lib/go-auth-provider", () => ({ useGoAuth: () => auth }));
vi.mock("../../../../../lib/learner-api", () => ({ learnerApiFetch }));

import viMessages from "../../../../../messages/vi.json";
import { ReadingAssistSettingsClient } from "./reading-assist-settings-client";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(() => {
  document.body.innerHTML = "";
  learnerApiFetch.mockReset();
});

it("preserves the loaded romaji preference when saving the display mode", async () => {
  learnerApiFetch.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith("/api/reading-assist/preferences") && !init?.method) {
      return Promise.resolve(new Response(JSON.stringify({ displayMode: "hover", showRomaji: true })));
    }
    if (path === "/api/flashcards/decks?limit=1") {
      return Promise.resolve(new Response("[]"));
    }
    if (path === "/api/reading-assist/analyze") {
      return Promise.resolve(new Response(JSON.stringify({ tokens: [], textHash: "hash", normalized: "text" })));
    }
    return Promise.resolve(new Response(JSON.stringify({ updated: true })));
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  try {
    await act(async () => {
      root.render(<ReadingAssistSettingsClient labels={viMessages.readingPage} />);
      await Promise.resolve();
    });
    await act(async () => {
      const select = container.querySelector("select")!;
      select.value = "difficult";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes(viMessages.readingPage.savePrefs))!
        .click();
      await Promise.resolve();
    });

    const saveCall = learnerApiFetch.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(saveCall).toBeDefined();
    expect(JSON.parse(saveCall![1]!.body as string)).toEqual({
      displayMode: "difficult",
      showRomaji: true,
      userId: "learner-test"
    });
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
