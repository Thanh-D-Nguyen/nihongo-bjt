// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { act } = React;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const auth = vi.hoisted(() => ({ isAuthenticated: true, isLoading: false }));
vi.mock("../../../../../lib/go-auth-provider", () => ({ useGoAuth: () => auth }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>
}));

import viMessages from "../../../../../messages/vi.json";
import { AppearanceSettingsClient } from "./appearance-settings-client";

const labels = viMessages.appearancePage;

beforeEach(() => {
  auth.isAuthenticated = true;
  auth.isLoading = false;
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("AppearanceSettingsClient", () => {
 it("localizes the saving status while the update is pending", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ themeMode: "system" }))).mockImplementationOnce(() => new Promise(() => {})));
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
   await act(async () => root.render(<AppearanceSettingsClient labels={{ ...labels, saving: "Đang lưu…" }} locale="vi" />));
   await act(async () => {
    [...host.querySelectorAll("button")].find(b => b.textContent?.includes(labels.themeDark))?.click();
    await new Promise(resolve => setTimeout(resolve, 650));
   });
   expect(host.textContent).toContain("Đang lưu…");
   expect(host.textContent).not.toContain("Saving…");
  } finally {
   await act(async () => root.unmount());
   host.remove();
  }
 });
  it("does not show saved after the profile endpoint rejects the update", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            themeMode: "system",
            fontSizePreference: "default",
            densityPreference: "comfortable"
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<AppearanceSettingsClient labels={labels} locale="vi" />);
      await Promise.resolve();
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes(labels.themeDark))
        ?.click();
      await new Promise((resolve) => setTimeout(resolve, 650));
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain(labels.saved);
    expect(container.textContent).toContain(labels.saveError);

    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps anonymous appearance choices local", async () => {
    auth.isAuthenticated = false;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<AppearanceSettingsClient labels={labels} locale="vi" />);
      await Promise.resolve();
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent?.includes(labels.themeDark))
        ?.click();
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("nihongo-appearance")).toContain('"theme":"dark"');

    await act(async () => root.unmount());
    container.remove();
  });

  it("does not replace a learner choice when the initial profile request resolves late", async () => {
    let finishLoad!: (response: Response) => void;
    const load = new Promise<Response>((resolve) => { finishLoad = resolve; });
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => load)
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(<AppearanceSettingsClient labels={labels} locale="vi" />);
        await Promise.resolve();
      });
      await act(async () => {
        Array.from(container.querySelectorAll("button"))
          .find((button) => button.textContent?.includes(labels.themeDark))?.click();
        await Promise.resolve();
      });

      await act(async () => {
        finishLoad(new Response(JSON.stringify({
          themeMode: "system",
          fontSizePreference: "default",
          densityPreference: "comfortable"
        }), { status: 200 }));
        await new Promise((resolve) => setTimeout(resolve, 650));
      });

      expect(localStorage.getItem("nihongo-appearance")).toContain('"theme":"dark"');
      expect(Array.from(container.querySelectorAll("main button"))
        .find((button) => button.textContent?.includes(labels.themeDark))?.className)
        .toContain("border-accent");
    } finally {
      finishLoad(new Response("{}", { status: 200 }));
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("persists a learner choice made while auth is loading instead of replacing it with the profile", async () => {
    auth.isAuthenticated = false;
    auth.isLoading = true;
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(<AppearanceSettingsClient labels={labels} locale="vi" />);
        await Promise.resolve();
      });
      await act(async () => {
        Array.from(container.querySelectorAll("button"))
          .find((button) => button.textContent?.includes(labels.themeDark))?.click();
        await Promise.resolve();
      });
      expect(fetchMock).not.toHaveBeenCalled();

      await act(async () => {
        auth.isAuthenticated = true;
        auth.isLoading = false;
        root.render(<AppearanceSettingsClient labels={labels} locale="en" />);
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 650));
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("PUT");
      expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string).themeMode).toBe("dark");
      expect(localStorage.getItem("nihongo-appearance")).toContain('"theme":"dark"');
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("serializes saves so an older response cannot overwrite the newest choice", async () => {
    let finishFirst!: (response: Response) => void;
    let finishSecond!: (response: Response) => void;
    const first = new Promise<Response>((resolve) => { finishFirst = resolve; });
    const second = new Promise<Response>((resolve) => { finishSecond = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ themeMode: "system", fontSizePreference: "default", densityPreference: "comfortable" }), { status: 200 }))
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(() => second);
    vi.stubGlobal("fetch", fetchMock);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(<AppearanceSettingsClient labels={labels} locale="vi" />);
        await Promise.resolve();
      });
      await act(async () => {
        Array.from(container.querySelectorAll("button"))
          .find((button) => button.textContent?.includes(labels.themeDark))?.click();
        await new Promise((resolve) => setTimeout(resolve, 650));
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);

      await act(async () => {
        Array.from(container.querySelectorAll("button"))
          .find((button) => button.textContent?.includes(labels.themeLight))?.click();
        await new Promise((resolve) => setTimeout(resolve, 650));
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);

      await act(async () => {
        finishFirst(new Response("{}", { status: 200 }));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      const latestBody = fetchMock.mock.calls[2]?.[1]?.body as string;
      expect(JSON.parse(latestBody).themeMode).toBe("light");
      expect(container.textContent).not.toContain(labels.saved);

      await act(async () => {
        finishSecond(new Response("{}", { status: 200 }));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(container.textContent).toContain(labels.saved);
    } finally {
      finishFirst(new Response("{}", { status: 200 }));
      finishSecond(new Response("{}", { status: 200 }));
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
