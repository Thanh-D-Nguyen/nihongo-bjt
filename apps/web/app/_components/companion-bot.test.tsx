// @vitest-environment jsdom
import { act, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../messages/en.json";
import { CompanionBot } from "./companion-bot";
import { CompanionMessageItem } from "./companion-message";
import { CompanionSpeechBubble } from "./companion-speech-bubble";

vi.mock("../../lib/go-auth-provider", () => ({ useGoAuth: () => ({ isAuthenticated: true }) }));
vi.mock("../../lib/learner-api", () => ({ learnerApiFetch: vi.fn() }));
vi.mock("./battle-bot-avatar", () => ({ BattleBotAvatar: () => <span>Shiba</span> }));
vi.mock("../_hooks/use-companion-engine", () => ({ useCompanionEngine: () => ({
  wakeUp: vi.fn(), sleeping: false, mood: "idle", isOnboarding: false, messages: [], quickReplies: [],
  memory: { memory: { bubbleMuted: false, localStreakDays: 0 }, incrementPanelOpen: vi.fn() },
}) }));

import { learnerApiFetch } from "../../lib/learner-api";

class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p>page crashed</p> : this.props.children; }
}

describe("CompanionBot API boundary", () => {
  const container = document.createElement("div");
  let root: ReturnType<typeof createRoot>;
  afterEach(async () => { if (root) await act(() => root.unmount()); vi.restoreAllMocks(); });

  it("keeps malformed authenticated hints inside the bot error state", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(learnerApiFetch).mockResolvedValue(new Response(JSON.stringify({ hints: [{ text: "legacy" }] })));
    root = createRoot(container);
    await act(() => root.render(<PageBoundary><CompanionBot base="/en" locale="en" labels={messages.nav.companion} /></PageBoundary>));
    await act(async () => { container.querySelector<HTMLElement>("[tabindex]")!.click(); });
    expect(container.textContent).toContain(messages.nav.companion.hintError);
    expect(container.querySelector("input")).not.toBeNull();
  });

  it("renders the bot at mobile widths and clears the bottom navigation", async () => {
    root = createRoot(container);
    await act(() => root.render(<PageBoundary><CompanionBot base="/en" locale="en" labels={messages.nav.companion} /></PageBoundary>));
    const aside = container.querySelector("aside");
    expect(aside, "companion root must be rendered").not.toBeNull();
    expect(aside!.className, "companion root must not be hidden below the lg breakpoint").not.toContain("hidden");
    const mascot = aside!.querySelector<HTMLElement>('[style*="width"]');
    expect(mascot, "mascot container must be rendered").not.toBeNull();
    expect(mascot!.className, "mascot must clear the mobile bottom navigation bar").toContain("bottom-[calc(69px_+_env(safe-area-inset-bottom))]");
    expect(mascot!.className, "mascot must keep its desktop offset on lg screens").toContain("lg:bottom-[max(24px,calc(24px_+_env(safe-area-inset-bottom)))]");
    expect(mascot!.style.bottom, "mascot bottom must come from the responsive classes, not an inline style").toBe("");
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
