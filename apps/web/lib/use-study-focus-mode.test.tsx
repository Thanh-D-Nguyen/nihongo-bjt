// @vitest-environment jsdom

import React, { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { STUDY_FOCUS_MODE_KEY, useStudyFocusMode } from "./use-study-focus-mode";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function Consumer({ id }: { id: string }) {
  const { focused, toggle } = useStudyFocusMode();
  return (
    <button
      aria-checked={focused}
      data-testid={id}
      onClick={toggle}
      role="switch"
      type="button"
    >
      {focused ? "ON" : "OFF"}
    </button>
  );
}

let activeRoot: Root | null = null;
let activeContainer: HTMLDivElement | null = null;

beforeEach(() => {
  window.localStorage.removeItem(STUDY_FOCUS_MODE_KEY);
});

afterEach(() => {
  if (activeRoot) {
    act(() => activeRoot?.unmount());
    activeRoot = null;
  }
  activeContainer?.remove();
  activeContainer = null;
  window.localStorage.removeItem(STUDY_FOCUS_MODE_KEY);
  vi.restoreAllMocks();
});

describe("useStudyFocusMode", () => {
  it("syncs multiple consumers cleanly under StrictMode and reacts to storage events", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const container = document.createElement("div");
    document.body.appendChild(container);
    activeContainer = container;
    activeRoot = createRoot(container);

    await act(async () => {
      activeRoot!.render(
        <StrictMode>
          <Consumer id="first" />
          <Consumer id="second" />
        </StrictMode>
      );
    });

    const first = container.querySelector<HTMLButtonElement>('[data-testid="first"]');
    const second = container.querySelector<HTMLButtonElement>('[data-testid="second"]');
    expect(first?.getAttribute("aria-checked")).toBe("false");
    expect(second?.getAttribute("aria-checked")).toBe("false");

    await act(async () => {
      first?.click();
    });

    expect(first?.getAttribute("aria-checked")).toBe("true");
    expect(second?.getAttribute("aria-checked")).toBe("true");
    expect(window.localStorage.getItem(STUDY_FOCUS_MODE_KEY)).toBe("true");
    expect(errorSpy).not.toHaveBeenCalled();

    // Cross-tab storage event updates both consumers
    window.localStorage.setItem(STUDY_FOCUS_MODE_KEY, "false");
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STUDY_FOCUS_MODE_KEY,
          newValue: "false"
        })
      );
    });

    expect(first?.getAttribute("aria-checked")).toBe("false");
    expect(second?.getAttribute("aria-checked")).toBe("false");
  });
});
