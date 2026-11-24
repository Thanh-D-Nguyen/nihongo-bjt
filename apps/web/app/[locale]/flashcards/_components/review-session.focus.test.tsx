// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }));

vi.mock("../../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({ userId: "user-1" })
}));

vi.mock("../../../../lib/learner-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../lib/learner-api")>()),
  learnerApiFetch: fetchApi
}));

vi.mock("../../../../lib/japanese-speech", () => ({
  speakJapanese: vi.fn()
}));

import viMessages from "../../../../messages/vi.json";
import { ReviewSession } from "./review-session";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const FOCUS_STORAGE_KEY = "kiokoto:study-focus-mode:v1";

const SAMPLE_CARDS = [
  {
    id: "review-1",
    cardId: "card-1",
    card: {
      id: "card-1",
      frontText: "納期",
      backText: "Thời hạn giao hàng",
      reading: "のうき"
    },
    primaryAudio: null,
    primaryImage: null,
    state: "review"
  }
];

let activeRoot: Root | null = null;
let activeContainer: HTMLDivElement | null = null;

async function startReviewSession(): Promise<HTMLDivElement> {
  fetchApi.mockImplementation(async (path: string) => ({
    ok: true,
    json: async () => (path.includes("distractors") ? { items: ["Báo cáo"] } : SAMPLE_CARDS)
  }));
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainer = container;
  activeRoot = createRoot(container);

  await act(async () => {
    activeRoot!.render(<ReviewSession labels={viMessages.reviewSession} locale="vi" onExit={() => {}} />);
  });
  await act(async () => {
    [...container.querySelectorAll("button")]
      .find((button) => button.textContent?.includes(viMessages.reviewSession.startSession))
      ?.click();
  });
  return container;
}

beforeEach(() => {
  window.localStorage.removeItem(FOCUS_STORAGE_KEY);
  fetchApi.mockReset();
});

afterEach(() => {
  if (activeRoot) {
    act(() => activeRoot?.unmount());
    activeRoot = null;
  }
  activeContainer?.remove();
  activeContainer = null;
  window.localStorage.removeItem(FOCUS_STORAGE_KEY);
});

describe("ReviewSession study focus mode toggle (WEB-447)", () => {
  it("defaults OFF, hides ambient review UI when toggled ON, and persists across remounts", async () => {
    const container = await startReviewSession();

    const toggle = container.querySelector<HTMLButtonElement>('header button[role="switch"]');
    expect(toggle, "review session header must include a focus toggle switch").not.toBeNull();
    expect(toggle?.getAttribute("aria-checked")).toBe("false");
    expect(toggle?.textContent).toContain("Tập trung");
    expect(
      container.textContent,
      "ambient keyboard hint must be visible when focus mode is OFF"
    ).toContain(viMessages.reviewSession.keyboardHint);

    await act(async () => {
      toggle?.click();
    });

    expect(toggle?.getAttribute("aria-checked")).toBe("true");
    expect(window.localStorage.getItem(FOCUS_STORAGE_KEY)).toBe("true");
    expect(
      container.textContent,
      "ambient keyboard hint footer must hide when focus mode is ON"
    ).not.toContain(viMessages.reviewSession.keyboardHint);
    expect(container.textContent, "core card prompt must remain visible in focus mode").toContain(
      "納期"
    );

    // Unmount and remount to confirm localStorage persistence
    await act(async () => {
      activeRoot?.unmount();
      activeRoot = null;
    });
    container.remove();
    activeContainer = null;

    const remounted = await startReviewSession();
    const remountedToggle = remounted.querySelector<HTMLButtonElement>('header button[role="switch"]');
    expect(remountedToggle?.getAttribute("aria-checked")).toBe("true");
    expect(remounted.textContent).not.toContain(viMessages.reviewSession.keyboardHint);
  });
});
