// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { act } = React;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({ userId: "11111111-1111-4111-8111-111111111111" })
}));
vi.mock("../../../../lib/learner-api", () => ({ learnerApiFetch: api.fetch }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search)
}));

import { AccountsSettingsClient as AccountsClient } from "./_components/accounts-settings-client";
import { AccountsSettingsClient as LinkedAccountsClient } from "../linked-accounts/_components/accounts-settings-client";

const labels = {
  connected: "Connected",
  exchangeError: "Could not unlink account",
  exchangeOk: "Linked",
  googleCta: "Google",
  identitiesEmpty: "No linked accounts",
  subtitle: "Subtitle",
  title: "Accounts",
  unlink: "Unlink",
  userId: "User"
};

async function assertServerErrorIsShown(Component: typeof AccountsClient) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  api.fetch
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            createdAt: new Date().toISOString(),
            emailAtLink: "linked@example.test",
            id: "22222222-2222-4222-8222-222222222222",
            provider: "google"
          }
        ]),
        { status: 200 }
      )
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Google identity could not be revoked" }), {
        status: 403
      })
    );

  await act(async () => {
    root.render(<Component labels={labels} />);
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>("button")?.click();
    await Promise.resolve();
  });

  expect(container.textContent).toContain("Google identity could not be revoked");
  expect(container.textContent).not.toContain("unlink");
  await act(async () => root.unmount());
  container.remove();
}

afterEach(() => {
  document.body.innerHTML = "";
  api.fetch.mockReset();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("linked account error contract", () => {
  it("shows the API error on the accounts screen", () => assertServerErrorIsShown(AccountsClient));
  it("shows the API error on the linked accounts screen", () =>
    assertServerErrorIsShown(LinkedAccountsClient));

  it("omits the retired Google OAuth action on linked accounts", async () => {
    api.fetch.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LinkedAccountsClient labels={labels} />);
    });

    expect(container.querySelector('a[href*="/api/auth/google/start"]')).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  it("omits the retired Google OAuth action on account settings", async () => {
    api.fetch.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<AccountsClient labels={labels} />);
    });

    expect(container.querySelector('a[href*="/api/auth/google/start"]')).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  it("does not exchange a retired link code on account settings", async () => {
    api.fetch.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    window.history.replaceState({}, "", "/vi/settings/accounts?linkCode=retired");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 404 }));
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<AccountsClient labels={labels} />);
    });

    expect(fetchSpy).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps account unlink controls at a 48px mobile target", async () => {
    api.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            createdAt: new Date().toISOString(),
            emailAtLink: "linked@example.test",
            id: "22222222-2222-4222-8222-222222222222",
            provider: "google"
          }
        ]),
        { status: 200 }
      )
    );
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<AccountsClient labels={labels} />);
    });

    expect(container.querySelector("button")?.classList.contains("min-h-12")).toBe(true);

    await act(async () => root.unmount());
    container.remove();
  });

  it("does not exchange a retired link code on linked accounts", async () => {
    api.fetch.mockResolvedValueOnce(new Response("[]", { status: 200 }));
    window.history.replaceState({}, "", "/vi/settings/linked-accounts?linkCode=retired");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 404 }));
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LinkedAccountsClient labels={labels} />);
    });

    expect(fetchSpy).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps the linked identity unlink action at a 48px mobile target", async () => {
    api.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            createdAt: new Date().toISOString(),
            emailAtLink: "linked@example.test",
            id: "22222222-2222-4222-8222-222222222222",
            provider: "google"
          }
        ]),
        { status: 200 }
      )
    );
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<LinkedAccountsClient labels={labels} />);
    });

    expect(container.querySelector("button")?.classList.contains("min-h-12")).toBe(true);

    await act(async () => root.unmount());
    container.remove();
  });
});
