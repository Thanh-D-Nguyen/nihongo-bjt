// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { act } = React;

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("tab=overview")
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", { href, ...props }, children)
}));
vi.mock("../../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({
    displayName: "Learner",
    email: "learner@example.test",
    isAuthenticated: true,
    loading: false,
    reload: vi.fn()
  })
}));
vi.mock("../../profile/_components/use-profile-image-upload", () => ({
  useProfileImageUpload: () => ({ uploading: false, upload: vi.fn() })
}));
vi.mock("./me-tab-progress", () => ({ MeTabProgress: () => null }));
vi.mock("./me-tab-achievements", () => ({ MeTabAchievements: () => null }));
vi.mock("./me-tab-settings", () => ({ MeTabSettings: () => <div>Account settings</div> }));

import messages from "../../../../messages/vi.json";
import { MePageClient } from "./me-page-client";

describe("MePageClient mobile tabs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lays out all four tabs within the available mobile row", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/api/analytics/learner")
        ? { totals: { streakDays: 2, reviewCount: 7, bjtAccuracyPct: 80 } }
        : url.includes("/api/flashcards/reviews/due")
          ? [{ id: "due-1" }, { id: "due-2" }]
          : { id: "learner-1", displayName: "Learner", email: "learner@example.test", status: "active" };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MePageClient
          labels={messages.mePage}
          analyticsLabels={messages.analytics}
          gamificationLabels={messages.gamification}
          settingsLabels={{ settings: messages.settings, accountInfo: messages.accountInfo }}
          locale="vi"
        />
      );
    });

    const tablist = container.querySelector<HTMLElement>('[role="tablist"]');
    const row = tablist?.firstElementChild as HTMLElement | null;
    expect(row?.className).toContain("grid-cols-4");
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(4);
    expect(container.querySelector('[role="tab"]')?.className).toContain("min-h-12");
    expect(fetchMock).toHaveBeenCalledWith("/api/analytics/learner?days=7", { credentials: "same-origin" });
    expect(fetchMock).toHaveBeenCalledWith("/api/flashcards/reviews/due?limit=500", { credentials: "same-origin" });
    expect(fetchMock).not.toHaveBeenCalledWith("/api/learner/analytics?days=7", { credentials: "same-origin" });
    const dueCardsLabel = [...container.querySelectorAll("p")].find((element) => element.textContent === messages.mePage.stats.dueCards);
    expect(dueCardsLabel?.parentElement?.textContent).toContain("2");

    await act(async () => root.unmount());
    container.remove();
  });
});
