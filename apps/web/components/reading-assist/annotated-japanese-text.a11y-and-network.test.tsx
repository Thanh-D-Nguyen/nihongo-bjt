// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { act } = React;

import { AnnotatedJapaneseText } from "./annotated-japanese-text";

const learnerApiFetchMock = vi.fn();

vi.mock("../../lib/learner-api", () => ({
  learnerApiFetch: (...args: unknown[]) => learnerApiFetchMock(...args)
}));

const labels = {
  addCardAction: "Add",
  addCardError: "Add error",
  addCardNoDeck: "No deck",
  addCardSuccess: "Added",
  bottomSheetClose: "Close",
  errorHttp: "HTTP error",
  errorNetwork: "Network error",
  errorTimeout: "Timeout",
  furiganaLabel: "Furigana",
  lexemeLine: "Lexeme",
  loadingText: "Loading",
  meaningLabel: "Meaning",
  posLabel: "POS",
  retryAction: "Retry",
  serviceUnavailable: "Reading support temporarily unavailable"
};

function jsonResponse(body: unknown, ok = true) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: ok ? 200 : 500
  });
}

describe("AnnotatedJapaneseText a11y and network behavior", () => {
  beforeEach(() => {
    learnerApiFetchMock.mockReset();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        addEventListener: vi.fn(),
        matches: query.includes("pointer: coarse"),
        media: query,
        removeEventListener: vi.fn()
      }))
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("supports Enter open, Escape close, and focus restore in bottom sheet", async () => {
    learnerApiFetchMock.mockImplementation((path: string) => {
      if (path.startsWith("/api/decks")) {
        return Promise.resolve(jsonResponse([{ id: "deck-1" }]));
      }
      if (path === "/api/reading-assist/analyze") {
        return Promise.resolve(
          jsonResponse({
            normalized: "確認",
            textHash: "hash-1",
            tokens: [
              {
                basicForm: "確認",
                end: 2,
                index: 0,
                lexemeId: "lex-1",
                partOfSpeech: "noun",
                reading: "かくにん",
                shortMeaningVi: "xac nhan",
                start: 0,
                surface: "確認"
              }
            ]
          })
        );
      }
      return Promise.resolve(jsonResponse({}));
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AnnotatedJapaneseText
          analyticsPath="/api/reading-assist/analytics"
          analyzePath="/api/reading-assist/analyze"
          displayMode="hover"
          labels={labels}
          text="確認"
          userId="11111111-1111-4111-8111-111111111111"
        />
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const tokenButton = container.querySelector("button.annotated-ja__token") as HTMLButtonElement;
    expect(tokenButton).toBeTruthy();
    tokenButton.focus();

    await act(async () => {
      tokenButton.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "Enter"
        })
      );
    });

    expect(container.querySelector('[role="dialog"]')).toBeTruthy();

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          key: "Escape"
        })
      );
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(tokenButton);

    root.unmount();
    container.remove();
  });

  it("deduplicates in-flight analyze requests with the same text+context key", async () => {
    learnerApiFetchMock.mockImplementation((path: string) => {
      if (path.startsWith("/api/decks")) {
        return Promise.resolve(jsonResponse([{ id: "deck-1" }]));
      }
      if (path === "/api/reading-assist/analyze") {
        return Promise.resolve(
          jsonResponse({
            normalized: "確認",
            textHash: "hash-1",
            tokens: []
          })
        );
      }
      return Promise.resolve(jsonResponse({}));
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <>
          <AnnotatedJapaneseText
            analyticsPath="/api/reading-assist/analytics"
            analyzePath="/api/reading-assist/analyze"
            displayMode="hover"
            labels={labels}
            text="確認"
            userId="11111111-1111-4111-8111-111111111111"
          />
          <AnnotatedJapaneseText
            analyticsPath="/api/reading-assist/analytics"
            analyzePath="/api/reading-assist/analyze"
            displayMode="hover"
            labels={labels}
            text="確認"
            userId="11111111-1111-4111-8111-111111111111"
          />
        </>
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const analyzeCalls = learnerApiFetchMock.mock.calls.filter(
      (call) => call[0] === "/api/reading-assist/analyze"
    );
    expect(analyzeCalls).toHaveLength(1);

    root.unmount();
    container.remove();
  });

  it("shows timeout message when analyze request exceeds 5 seconds", async () => {
    vi.useFakeTimers();

    learnerApiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path.startsWith("/api/decks")) {
        return Promise.resolve(jsonResponse([{ id: "deck-1" }]));
      }
      if (path === "/api/reading-assist/analyze") {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      }
      return Promise.resolve(jsonResponse({}));
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AnnotatedJapaneseText
          analyticsPath="/api/reading-assist/analytics"
          analyzePath="/api/reading-assist/analyze"
          displayMode="hover"
          labels={labels}
          text="確認"
          userId="11111111-1111-4111-8111-111111111111"
        />
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(5100);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Timeout");
    expect(container.textContent).toContain("Retry");

    root.unmount();
    container.remove();
  });

  it("shows support unavailable hint when deck loading fails", async () => {
    learnerApiFetchMock.mockImplementation((path: string) => {
      if (path.startsWith("/api/decks")) {
        return Promise.resolve(jsonResponse({ code: "deck_failed" }, false));
      }
      if (path === "/api/reading-assist/analyze") {
        return Promise.resolve(
          jsonResponse({
            normalized: "確認",
            textHash: "hash-1",
            tokens: [
              {
                basicForm: "確認",
                end: 2,
                index: 0,
                lexemeId: "lex-1",
                partOfSpeech: "noun",
                reading: "かくにん",
                shortMeaningVi: "xac nhan",
                start: 0,
                surface: "確認"
              }
            ]
          })
        );
      }
      return Promise.resolve(jsonResponse({}));
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AnnotatedJapaneseText
          analyticsPath="/api/reading-assist/analytics"
          analyzePath="/api/reading-assist/analyze"
          displayMode="hover"
          labels={labels}
          text="確認"
          userId="11111111-1111-4111-8111-111111111111"
        />
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Reading support temporarily unavailable");

    root.unmount();
    container.remove();
  });
});
