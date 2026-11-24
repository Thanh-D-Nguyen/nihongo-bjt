// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { learnerApiFetchMock, logoutMock } = vi.hoisted(() => ({
  learnerApiFetchMock: vi.fn(),
  logoutMock: vi.fn()
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", { href, ...props }, children)
}));

vi.mock("../../../../components/auth/require-auth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children)
}));

vi.mock("../../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({
    displayName: "Minh Nguyen",
    email: "minh@example.test",
    isAuthenticated: true,
    isLoading: false,
    loading: false,
    logout: logoutMock,
    userId: "11111111-1111-4111-8111-111111111111"
  })
}));

vi.mock("../../../../lib/learner-api", () => ({
  learnerApiFetch: (...args: unknown[]) => learnerApiFetchMock(...args)
}));

import viMessages from "../../../../messages/vi.json";
import AccountsSettingsPage from "./page";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let activeRoot: Root | null = null;
let activeContainer: HTMLDivElement | null = null;

afterEach(() => {
  if (activeRoot) {
    act(() => activeRoot?.unmount());
    activeRoot = null;
  }
  activeContainer?.remove();
  activeContainer = null;
  learnerApiFetchMock.mockReset();
  logoutMock.mockReset();
});

describe("unified /[locale]/settings/accounts page (WEB-447)", () => {
  it("renders real learner identity together with linked accounts management and privacy/data link", async () => {
    learnerApiFetchMock.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    const element = await AccountsSettingsPage({ params: Promise.resolve({ locale: "vi" }) });
    const container = document.createElement("div");
    document.body.appendChild(container);
    activeContainer = container;
    activeRoot = createRoot(container);

    await act(async () => {
      activeRoot!.render(element);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      container.textContent,
      "accounts settings page must display learner display name"
    ).toContain("Minh Nguyen");
    expect(container.textContent, "accounts settings page must display learner email").toContain(
      "minh@example.test"
    );
    expect(
      container.textContent,
      "accounts settings page must still render linked social accounts section"
    ).toContain(viMessages.accounts.linkedAccountsEmpty);
    expect(
      container.querySelector('a[href="/vi/settings/privacy"]'),
      "accounts settings page must link to data & privacy actions"
    ).toBeTruthy();
  });
});
