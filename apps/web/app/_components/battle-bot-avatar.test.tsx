// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@rive-app/react-canvas", () => ({
  Alignment: { Center: "center" },
  EventType: { Load: "load" },
  Fit: { Contain: "contain" },
  Layout: class Layout {},
  useRive: () => ({
    RiveComponent: ({ className }: { className?: string }) => (
      <div className={className} data-testid="rive-canvas" />
    ),
    rive: null,
  }),
}));

import { BattleBotAvatar } from "./battle-bot-avatar";

const sampleRive = {
  artboard: null,
  src: "/assets/battle/bots/18912-35694-lil-guy.riv",
  stateMachine: null,
};

describe("BattleBotAvatar", () => {
  it("uses non-clipping overflow for companion variant while keeping framed variants clipped", () => {
    const companionHtml = renderToStaticMarkup(
      <BattleBotAvatar
        className="h-full w-full"
        fallback="🐕"
        rive={sampleRive}
        showSignal={false}
        state="correct"
        variant="companion"
      />,
    );
    const host = document.createElement("div");
    host.innerHTML = companionHtml;
    const rootSpan = host.firstElementChild as HTMLElement | null;
    expect(rootSpan).not.toBeNull();
    expect(
      rootSpan!.className,
      "companion avatar must use overflow-visible so animated edges are not sliced",
    ).toContain("overflow-visible");
    expect(rootSpan!.className).not.toContain("overflow-hidden");

    const canvasWrapper = host.querySelector('[data-testid="rive-canvas"]')?.parentElement;
    expect(canvasWrapper).not.toBeNull();
    expect(canvasWrapper!.className).toContain("min-h-0");
    expect(canvasWrapper!.className).toContain("min-w-0");

    const cardHtml = renderToStaticMarkup(
      <BattleBotAvatar
        className="h-10 w-10"
        fallback="🤖"
        rive={sampleRive}
        state="idle"
        variant="card"
      />,
    );
    host.innerHTML = cardHtml;
    const cardSpan = host.firstElementChild as HTMLElement | null;
    expect(cardSpan!.className).toContain("overflow-hidden");
  });
});
