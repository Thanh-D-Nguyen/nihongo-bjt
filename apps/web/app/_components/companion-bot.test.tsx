// @vitest-environment jsdom
import { act, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import enMessages from "../../messages/en.json";
import viMessages from "../../messages/vi.json";
import { CompanionBot } from "./companion-bot";
import { CompanionMessageItem } from "./companion-message";
import { CompanionSpeechBubble } from "./companion-speech-bubble";

const useCompanionEngineMock = vi.hoisted(() =>
  vi.fn(() => ({
    wakeUp: vi.fn(),
    sleeping: false,
    mood: "idle",
    isOnboarding: false,
    messages: [],
    quickReplies: [],
    bubbleText: null,
    bubbleMood: "idle",
    showCelebration: false,
    celebrationEmoji: "🎉",
    onboardingStep: 0,
    advanceOnboarding: vi.fn(),
    dismissOnboarding: vi.fn(),
    handleQuickReply: vi.fn(),
    handleUserMessage: vi.fn(),
    pushEvent: vi.fn(),
    memory: { memory: { bubbleMuted: false, localStreakDays: 0 }, incrementPanelOpen: vi.fn(), update: vi.fn() }
  }))
);

vi.mock("../../lib/go-auth-provider", () => ({ useGoAuth: () => ({ isAuthenticated: true }) }));
vi.mock("../../lib/learner-api", () => ({ learnerApiFetch: vi.fn() }));
vi.mock("./battle-bot-avatar", () => ({ BattleBotAvatar: () => <span>Shiba</span> }));
vi.mock("../_hooks/use-companion-engine", () => ({
  useCompanionEngine: useCompanionEngineMock
}));

import { learnerApiFetch } from "../../lib/learner-api";

class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p>page crashed</p> : this.props.children; }
}

// WEB-443 contract change (ENGINEERING_POLICY.md §5):
// CompanionBot is demoted from an engine/chat/hint drawer to a lightweight mascot-only
// companion on /{locale} and /{locale}/me. The prior chat-hint error boundary test is
// replaced with assertions pinning zero useCompanionEngine mount, zero /api/companion/hint
// calls, zero chat/onboarding panels, and tap-to-delight 4s auto-hiding speech bubbles.
describe("CompanionBot mascot-only contract", () => {
  const container = document.createElement("div");
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useCompanionEngineMock.mockClear();
    vi.mocked(learnerApiFetch).mockClear();
  });

  afterEach(async () => {
    if (root) await act(() => root.unmount());
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs in mascot-only mode without mounting useCompanionEngine, calling /api/companion/hint, or rendering chat/onboarding panels", async () => {
    vi.mocked(learnerApiFetch).mockResolvedValue(new Response(JSON.stringify({ hints: [] }), { status: 200 }));
    root = createRoot(container);
    await act(() =>
      root.render(
        <PageBoundary>
          <CompanionBot base="/vi" locale="vi" labels={viMessages.nav.companion} />
        </PageBoundary>
      )
    );

    expect(
      useCompanionEngineMock,
      "CompanionBot mascot-only mode must not mount useCompanionEngine"
    ).not.toHaveBeenCalled();

    const trigger = container.querySelector<HTMLElement>("[tabindex]");
    expect(trigger, "mascot interactive trigger must be rendered").not.toBeNull();
    await act(async () => {
      trigger!.click();
    });

    expect(
      learnerApiFetch,
      "CompanionBot mascot-only mode must not call /api/companion/hint"
    ).not.toHaveBeenCalled();
    expect(container.querySelector("input"), "mascot-only mode must not render a chat input").toBeNull();
    expect(container.textContent).not.toContain(viMessages.nav.companion.hintError);
    expect(container.textContent).not.toContain(viMessages.nav.companion.onboardingStep1Body);
  });

  it("responds to tap with a cycling localized speech bubble that auto-hides after 4s", async () => {
    vi.useFakeTimers();
    root = createRoot(container);
    await act(() =>
      root.render(
        <PageBoundary>
          <CompanionBot base="/vi" locale="vi" labels={viMessages.nav.companion} />
        </PageBoundary>
      )
    );

    expect(container.querySelector('[role="status"]'), "bubble stays hidden before tap").toBeNull();

    const trigger = container.querySelector<HTMLElement>("[tabindex]")!;
    await act(async () => {
      trigger.click();
    });

    const firstBubble = container.querySelector('[role="status"]');
    expect(firstBubble, "tapping mascot must show a short speech bubble").not.toBeNull();
    const firstText = firstBubble!.textContent ?? "";
    expect(firstText.trim().length).toBeGreaterThan(0);

    await act(async () => {
      trigger.click();
    });
    const secondText = container.querySelector('[role="status"]')?.textContent ?? "";
    expect(secondText, "repeated taps must cycle to a different tip").not.toBe(firstText);

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    expect(
      container.querySelector('[role="status"]'),
      "speech bubble must auto-hide after 4s"
    ).toBeNull();
  });

  it("renders the bot at mobile widths and clears the bottom navigation", async () => {
    root = createRoot(container);
    await act(() => root.render(<PageBoundary><CompanionBot base="/en" locale="en" labels={enMessages.nav.companion} /></PageBoundary>));
    const aside = container.querySelector("aside");
    expect(aside, "companion root must be rendered").not.toBeNull();
    expect(aside!.className, "companion root must not be hidden below the lg breakpoint").not.toContain("hidden");
    const mascot = aside!.querySelector<HTMLElement>('[style*="width"]');
    expect(mascot, "mascot container must be rendered").not.toBeNull();
    expect(mascot!.className, "mascot must clear the mobile bottom navigation bar").toContain("bottom-[calc(69px_+_env(safe-area-inset-bottom))]");
    expect(mascot!.className, "mascot must keep its desktop offset on lg screens").toContain("lg:bottom-[max(24px,calc(24px_+_env(safe-area-inset-bottom)))]");
    expect(mascot!.style.bottom, "mascot bottom must come from the responsive classes, not an inline style").toBe("");
  });

  it("gives the companion mascot an explicit square box with non-clipping overflow", async () => {
    root = createRoot(container);
    await act(() => root.render(<PageBoundary><CompanionBot base="/en" locale="en" labels={enMessages.nav.companion} /></PageBoundary>));
    const aside = container.querySelector("aside");
    const mascot = aside!.querySelector<HTMLElement>('[style*="width"]');
    expect(mascot, "mascot container must be rendered").not.toBeNull();
    expect(mascot!.style.width).toBe("48px");
    expect(mascot!.style.height, "mascot container must declare an explicit square height").toBe("48px");
    const trigger = mascot!.querySelector<HTMLElement>("[tabindex]");
    expect(trigger, "mascot interactive trigger must be rendered").not.toBeNull();
    expect(trigger!.className, "mascot trigger must fill its square box without clipping").toContain("h-full");
    expect(trigger!.className).toContain("w-full");
    expect(trigger!.className).toContain("overflow-visible");
  });

  it("uses English messages and bubbles on the English route", () => {
    const text = { ja: "こんにちは", vi: "Xin chào", en: "Hello learner" };
    const html = renderToStaticMarkup(<>
      <CompanionMessageItem locale="en" message={{ id: "en", type: "greeting", sender: "bot", textJa: text.ja, textVi: text.vi, textEn: text.en, timestamp: Date.now() }} />
      <CompanionSpeechBubble locale="en" customText={text} mood="wave" visible />
    </>);
    expect(html.match(/Hello learner/g) ?? []).toHaveLength(2);
    expect(html).not.toContain("Xin chào");
    expect(html).not.toContain("vừa xong");
  });
});
