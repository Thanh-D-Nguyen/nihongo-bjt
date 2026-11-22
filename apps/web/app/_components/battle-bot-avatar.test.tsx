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

  it("applies dark-only circular disc framing and glare softening for companion variant without altering light-mode or framed variants", () => {
    const companionHtml = renderToStaticMarkup(
      <BattleBotAvatar
        className="h-full w-full"
        fallback="🐕"
        rive={sampleRive}
        showSignal={true}
        state="idle"
        variant="companion"
      />,
    );
    const host = document.createElement("div");
    host.innerHTML = companionHtml;
    const rootSpan = host.firstElementChild as HTMLElement | null;
    expect(rootSpan).not.toBeNull();
    const rootTokens = rootSpan!.className.split(/\s+/).filter(Boolean);
    expect(rootTokens).toContain("overflow-visible");
    expect(rootTokens).toContain("rounded-full");
    expect(rootTokens).not.toContain("overflow-hidden");
    expect(rootTokens).not.toContain("bg-surface");

    const canvas = host.querySelector<HTMLElement>('[data-testid="rive-canvas"]');
    expect(canvas).not.toBeNull();
    const canvasWrapper = canvas!.parentElement as HTMLElement | null;
    expect(canvasWrapper).not.toBeNull();
    const wrapperTokens = canvasWrapper!.className.split(/\s+/).filter(Boolean);
    expect(
      wrapperTokens,
      "companion canvas wrapper must clip into a themed circular disc in dark mode",
    ).toEqual(
      expect.arrayContaining([
        "dark:overflow-hidden",
        "dark:rounded-full",
        "dark:bg-surface",
        "dark:ring-1",
        "dark:ring-border-hover",
        "dark:shadow-md",
      ]),
    );
    // Light-mode wrapper classes must remain unchanged (no unprefixed clip/disc background).
    expect(wrapperTokens).not.toContain("overflow-hidden");
    expect(wrapperTokens).not.toContain("bg-surface");
    expect(wrapperTokens).not.toContain("ring-1");

    const canvasTokens = canvas!.className.split(/\s+/).filter(Boolean);
    expect(
      canvasTokens,
      "companion Rive canvas must apply dark-only full-bleed framing and balanced glare softening",
    ).toEqual(
      expect.arrayContaining([
        "h-full",
        "w-full",
        "dark:scale-[1.26]",
        "dark:brightness-[0.80]",
        "dark:contrast-[1.06]",
        "dark:saturate-[1.12]",
      ]),
    );
    expect(canvasTokens.some((token) => /^(?:dark:)?(?:invert|mix-blend-)/.test(token))).toBe(false);
    expect(canvasTokens.some((token) => /^(?:scale-|brightness-|contrast-|saturate-)/.test(token))).toBe(false);

    const signalDot = [...rootSpan!.children].find((child) =>
      child.className.includes("right-2") && child.className.includes("top-2"),
    );
    expect(signalDot, "companion signal badge must still render when showSignal is true").toBeDefined();
    expect(
      signalDot!.className.split(/\s+/),
      "companion signal badge must stack above the dark-mode circular disc",
    ).toContain("dark:z-20");

    for (const variant of ["card", "arena"] as const) {
      const otherHtml = renderToStaticMarkup(
        <BattleBotAvatar
          className="h-10 w-10"
          fallback="🤖"
          rive={sampleRive}
          state="idle"
          variant={variant}
        />,
      );
      host.innerHTML = otherHtml;
      const otherCanvas = host.querySelector<HTMLElement>('[data-testid="rive-canvas"]');
      expect(otherCanvas).not.toBeNull();
      expect(otherCanvas!.className).not.toContain("dark:brightness-");
      expect(otherCanvas!.className).not.toContain("dark:scale-");
      expect(otherCanvas!.parentElement!.className).not.toContain("dark:overflow-hidden");
    }
  });
});
