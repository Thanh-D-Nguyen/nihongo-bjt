// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", { href, ...props }, children)
}));

vi.mock("../../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({
    logout: vi.fn()
  })
}));

import viMessages from "../../../../messages/vi.json";
import { MeTabSettings } from "./me-tab-settings";

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
});

describe("MeTabSettings account settings dedupe (WEB-447)", () => {
  it("links once to /settings/accounts without duplicating /settings/linked-accounts or account forms", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    activeContainer = container;
    activeRoot = createRoot(container);

    await act(async () => {
      activeRoot!.render(
        <MeTabSettings labels={viMessages.mePage.settingsTab} settingsLabels={{}} locale="vi" />
      );
    });

    const links = [...container.querySelectorAll("a")];
    const hrefs = links.map((a) => a.getAttribute("href"));

    expect(hrefs, "account settings card must point to /vi/settings/accounts").toContain(
      "/vi/settings/accounts"
    );
    expect(
      hrefs,
      "duplicate /vi/settings/linked-accounts card must be removed from MeTabSettings"
    ).not.toContain("/vi/settings/linked-accounts");
    expect(links, "deduped settings grid must contain 6 unique destination cards").toHaveLength(6);
    expect(
      container.querySelectorAll("form"),
      "/me settings tab must link to settings rather than embedding duplicate account forms"
    ).toHaveLength(0);
  });
});
