// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../messages/en.json";
import ja from "../messages/ja.json";
import vietnamese from "../messages/vi.json";

const authMocks = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoading: true,
  loading: true,
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: authMocks.replace }),
}));

vi.mock("../lib/go-auth-provider", () => ({
  useGoAuth: () => ({
    isAuthenticated: authMocks.isAuthenticated,
    isLoading: authMocks.isLoading,
    loading: authMocks.loading,
  }),
}));

import { RequireAuth } from "../components/auth/require-auth";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  authMocks.isAuthenticated = false;
  authMocks.isLoading = true;
  authMocks.loading = true;
  authMocks.replace.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("RequireAuth", () => {
  it("renders a loading state while auth is loading instead of blank or protected content", async () => {
    for (const [locale, copy] of [["vi", vietnamese], ["ja", ja], ["en", en]] as const) {
      await act(async () => {
        root.render(
          <RequireAuth locale={locale}>
            <div data-testid="protected">Protected content</div>
          </RequireAuth>,
        );
      });

      const status = container.querySelector('[role="status"]');
      expect(
        status,
        "RequireAuth must render a loading status while auth is loading instead of blank content",
      ).not.toBeNull();
      expect(status!.getAttribute("aria-busy")).toBe("true");
      expect(status!.textContent).toContain(copy.nav.sessionChecking);
      expect(container.querySelector('[data-testid="protected"]')).toBeNull();
      expect(authMocks.replace).not.toHaveBeenCalled();
    }
  });

  it("redirects unauthenticated users with returnTo while showing loading state instead of blank or protected content", async () => {
    authMocks.isLoading = false;
    authMocks.loading = false;
    authMocks.isAuthenticated = false;
    window.history.replaceState({}, "", "/vi/flashcards?tab=review");

    await act(async () => {
      root.render(
        <RequireAuth locale="vi">
          <div data-testid="protected">Protected content</div>
        </RequireAuth>,
      );
    });

    expect(authMocks.replace).toHaveBeenCalledWith(
      "/vi/login?returnTo=%2Fvi%2Fflashcards%3Ftab%3Dreview",
    );
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="protected"]')).toBeNull();
  });

  it("renders protected children once authenticated", async () => {
    authMocks.isLoading = false;
    authMocks.loading = false;
    authMocks.isAuthenticated = true;

    await act(async () => {
      root.render(
        <RequireAuth locale="vi">
          <div data-testid="protected">Protected content</div>
        </RequireAuth>,
      );
    });

    expect(container.querySelector('[data-testid="protected"]')?.textContent).toBe(
      "Protected content",
    );
    expect(authMocks.replace).not.toHaveBeenCalled();
  });
});
