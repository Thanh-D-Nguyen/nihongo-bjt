// @vitest-environment jsdom

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { act } = React;

const requestCompanionChatMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/vi",
}));

vi.mock("../../lib/companion-chat", () => ({
  buildCompanionChatRequest: (messages: unknown, locale: string, text: string) => ({
    message: text,
    history: [],
    locale,
    _messages: messages,
  }),
  requestCompanionChat: (...args: unknown[]) => requestCompanionChatMock(...args),
}));

import { useCompanionEngine } from "./use-companion-engine";

type Engine = ReturnType<typeof useCompanionEngine>;

let engine: Engine | null = null;

function Probe({ isLoggedIn }: { isLoggedIn: boolean }) {
  engine = useCompanionEngine({ hint: null, isLoggedIn, locale: "vi", base: "/vi" });
  return null;
}

let container: HTMLDivElement;
let root: Root;

function mount(isLoggedIn: boolean) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<Probe isLoggedIn={isLoggedIn} />);
  });
}

function botHints() {
  return (engine?.messages ?? []).filter((m) => m.sender === "bot" && m.type === "hint");
}

describe("useCompanionEngine chat wiring", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    requestCompanionChatMock.mockReset();
    engine = null;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    vi.useRealTimers();
  });

  it("renders the LLM reply for a logged-in learner", async () => {
    requestCompanionChatMock.mockResolvedValue("「ありがとうございます」が丁寧です。");
    mount(true);

    await act(async () => {
      engine?.handleUserMessage("「ありがとう」の丁寧な言い方は？");
    });
    await act(async () => {});

    expect(requestCompanionChatMock).toHaveBeenCalledTimes(1);
    const hints = botHints();
    expect(hints).toHaveLength(1);
    expect(hints[0]?.textVi).toBe("「ありがとうございます」が丁寧です。");
  });

  it("falls back to rule-based replies when the chat API is unavailable", async () => {
    vi.useFakeTimers();
    requestCompanionChatMock.mockResolvedValue(null);
    mount(true);

    await act(async () => {
      engine?.handleUserMessage("keigo là gì?");
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(requestCompanionChatMock).toHaveBeenCalledTimes(1);
    const hints = botHints();
    expect(hints).toHaveLength(1);
    expect(hints[0]?.textVi).toContain("Kính ngữ cơ bản");
  });

  it("never calls the chat API for guests", async () => {
    vi.useFakeTimers();
    mount(false);

    await act(async () => {
      engine?.handleUserMessage("keigo là gì?");
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(requestCompanionChatMock).not.toHaveBeenCalled();
    const hints = botHints();
    expect(hints).toHaveLength(1);
    expect(hints[0]?.textVi).toContain("Kính ngữ cơ bản");
  });
});
