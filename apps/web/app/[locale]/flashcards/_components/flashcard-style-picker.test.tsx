// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FLASHCARD_THEME_DEFINITIONS } from "@nihongo-bjt/shared";

import {
  FlashcardStylePickerModal,
  FlashcardStyleGrid,
  type FlashcardStyleOption,
  type StylePickerLabels
} from "./flashcard-style-picker";

vi.mock("../../../../lib/learner-api", () => ({
  learnerApiFetch: (path: string, init?: RequestInit) => fetch(path, init)
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const labels: StylePickerLabels = {
  styleDescriptions: Object.fromEntries(
    FLASHCARD_THEME_DEFINITIONS.map((theme) => [theme.slug, `${theme.slug} description`])
  ),
  styleNames: Object.fromEntries(
    FLASHCARD_THEME_DEFINITIONS.map((theme) => [theme.slug, theme.slug])
  ),
  stylePickerActive: "Active",
  stylePickerApplied: "Applied",
  stylePickerApplyError: "Apply error",
  stylePickerApplying: "Applying",
  stylePickerClose: "Close",
  stylePickerDescription: "Description",
  stylePickerEmpty: "Empty",
  stylePickerExclusive: "Exclusive",
  stylePickerFree: "Free",
  stylePickerLoadError: "Load error",
  stylePickerLocked: "Locked",
  stylePickerPremium: "Premium",
  stylePickerPreviewLabel: "Preview",
  stylePickerRetry: "Retry",
  stylePickerScrollHint: "Scroll",
  stylePickerSelectTheme: "Select {name}",
  stylePickerTitle: "Styles",
  stylePickerUnnamed: "Style"
};

const styles: FlashcardStyleOption[] = FLASHCARD_THEME_DEFINITIONS.slice(0, 2).map((theme) => ({
  config: theme.config,
  descriptionKey: theme.descriptionKey,
  id: theme.slug,
  locked: false,
  nameKey: theme.nameKey,
  slug: theme.slug,
  tier: theme.tier
}));

let host: HTMLDivElement | null = null;

afterEach(() => {
  host?.remove();
  host = null;
  vi.unstubAllGlobals();
});

describe("FlashcardStyleGrid", () => {
  it("uses real buttons with a non-color selected indicator and aria-pressed", () => {
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        <FlashcardStyleGrid
          activeSlug="minimal-ink"
          applyingSlug={null}
          labels={labels}
          onSelect={() => undefined}
          styles={styles}
        />
      );
    });

    const buttons = [...host.querySelectorAll<HTMLButtonElement>("button")];
    expect(buttons).toHaveLength(2);
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    expect(buttons[0].textContent).toContain("✓");
    expect(buttons[1].getAttribute("aria-pressed")).toBe("false");
    expect(buttons[1].disabled).toBe(false);
    buttons[1].focus();
    expect(document.activeElement).toBe(buttons[1]);

    act(() => root.unmount());
  });

  it("selects a theme and renders its real semantic preview colors", () => {
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    let selected = "minimal-ink";

    const render = () =>
      root.render(
        <FlashcardStyleGrid
          activeSlug={selected}
          applyingSlug={null}
          labels={labels}
          onSelect={(style) => {
            selected = style.slug;
            render();
          }}
          styles={styles}
        />
      );

    act(render);
    const second = host.querySelectorAll<HTMLButtonElement>("button")[1];
    act(() => second.click());

    expect(selected).toBe("warm-paper");
    expect(host.querySelectorAll<HTMLButtonElement>("button")[1].getAttribute("aria-pressed")).toBe(
      "true"
    );
    const preview = host.querySelectorAll<HTMLElement>("[role='img']")[1];
    expect(preview.style.getPropertyValue("--flashcard-foreground")).toBe(
      styles[1].config.foreground
    );
    expect(preview.style.getPropertyValue("--flashcard-content-surface")).toBe(
      styles[1].config.contentSurface
    );

    act(() => root.unmount());
  });
});

describe("FlashcardStylePickerModal", () => {
  it("loads canonical styles and applies a selection through the learner API", async () => {
    const activeTheme = FLASHCARD_THEME_DEFINITIONS.find((theme) => theme.slug === "minimal-ink");
    const selectedTheme = FLASHCARD_THEME_DEFINITIONS.find((theme) => theme.slug === "warm-paper");
    expect(activeTheme).toBeDefined();
    expect(selectedTheme).toBeDefined();
    if (!activeTheme || !selectedTheme) throw new Error("Expected canonical flashcard themes");

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), window.location.origin).pathname;
      if (path === "/api/flashcards/styles" && init?.method === undefined) {
        return new Response(
          JSON.stringify({
            activeSlug: activeTheme.slug,
            styles: FLASHCARD_THEME_DEFINITIONS.map((theme) => ({
              config: theme.config,
              descriptionKey: theme.descriptionKey,
              id: theme.slug,
              locked: false,
              nameKey: theme.nameKey,
              slug: theme.slug,
              tier: theme.tier
            }))
          }),
          { headers: { "content-type": "application/json" }, status: 200 }
        );
      }
      if (path === "/api/flashcards/styles/active" && init?.method === "PUT") {
        return new Response("{}", { status: 200 });
      }
      throw new Error(`Unexpected learner API request: ${init?.method ?? "GET"} ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const onStyleApplied = vi.fn();

    await act(async () => {
      root.render(
        <FlashcardStylePickerModal
          labels={labels}
          onClose={() => undefined}
          onStyleApplied={onStyleApplied}
          open
        />
      );
    });

    const activeButton = host.querySelector<HTMLButtonElement>(
      `button[aria-label="Select ${activeTheme.slug}"]`
    );
    const selectedButton = host.querySelector<HTMLButtonElement>(
      `button[aria-label="Select ${selectedTheme.slug}"]`
    );
    expect(activeButton?.textContent).toContain(activeTheme.slug);
    expect(activeButton?.textContent).toContain(labels.stylePickerActive);
    expect(activeButton?.getAttribute("aria-pressed")).toBe("true");
    expect(selectedButton?.getAttribute("aria-pressed")).toBe("false");
    expect(fetchMock).toHaveBeenCalledWith("/api/flashcards/styles", undefined);

    await act(async () => {
      selectedButton?.click();
    });

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/flashcards/styles/active",
      expect.objectContaining({
        body: JSON.stringify({ slug: selectedTheme.slug }),
        method: "PUT"
      })
    );
    expect(host.querySelector("[role='status']")?.textContent).toBe(labels.stylePickerApplied);
    expect(onStyleApplied).toHaveBeenCalledWith(selectedTheme.config);
    expect(
      host
        .querySelector<HTMLButtonElement>(`button[aria-label="Select ${selectedTheme.slug}"]`)
        ?.getAttribute("aria-pressed")
    ).toBe("true");

    act(() => root.unmount());
  });
});
