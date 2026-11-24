// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import viMessages from "../../../messages/vi.json";

const usePresenceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));
vi.mock("../../../lib/go-auth-provider", () => ({
  GoAuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock("../../../hooks/use-presence", () => ({
  usePresence: usePresenceMock
}));
vi.mock("../../_components/appearance-sync", () => ({ AppearanceSync: () => null }));
vi.mock("../../_components/focus-mini-indicator", () => ({ FocusMiniIndicator: () => null }));
vi.mock("../../_components/learner-app-frame", () => ({
  LearnerAppFrame: ({ children }: { children: ReactNode }) => <div data-testid="app-frame">{children}</div>
}));
vi.mock("../../_hooks/use-focus-timer", () => ({
  FocusTimerProvider: ({ children }: { children: ReactNode }) => <>{children}</>
}));

import { AuthShell } from "./auth-shell";
import type { LearnerNavLabels } from "../../_components/learner-app-frame";

describe("AuthShell global presence removal", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    usePresenceMock.mockClear();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it("does not mount global PresenceConnector or open /ws/presence while rendering children", async () => {
    await act(async () => {
      root.render(
        <AuthShell
          companionLabels={viMessages.nav.companion}
          focusTimerLabels={viMessages.focusTimer}
          locale="vi"
          nav={viMessages.nav as unknown as LearnerNavLabels}
          presenceLabels={viMessages.presence}
          searchLabels={viMessages.search}
        >
          <p>learner content</p>
        </AuthShell>
      );
    });

    expect(
      usePresenceMock,
      "AuthShell must not mount global PresenceConnector or call usePresence"
    ).not.toHaveBeenCalled();
    expect(host.textContent).toContain("learner content");
  });
});
