// @vitest-environment jsdom

import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminShell } from "../../../packages/ui/src/admin-shell";
import { ADMIN_NAV_DATA } from "./admin-nav-data";
import { buildResolvedAdminNav } from "./resolve-admin-nav";
import en from "../messages/en.json";
import ja from "../messages/ja.json";
import vietnamese from "../messages/vi.json";
import AdminLogoutPage from "../app/auth/logout/page";

const routing = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(routing.search)
}));

let container: HTMLDivElement;
let root: Root;
const fetchMock = vi.fn();
const assignMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetchMock);
  const browserWindow = window;
  vi.stubGlobal(
    "window",
    new Proxy(browserWindow, {
      get: (target, property) =>
        property === "location" ? { assign: assignMock } : Reflect.get(target, property, target)
    })
  );
  fetchMock.mockReset().mockResolvedValue(new Response("{}", { status: 200 }));
  assignMock.mockReset();
  routing.search = "";
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(locale: string, normalizedPath = "/", chrome = vietnamese.shell) {
  const navGroups = buildResolvedAdminNav(ADMIN_NAV_DATA, (key) => key, locale, ["*"], {});
  await act(async () =>
    root.render(
      <AdminShell
        chrome={chrome}
        locale={locale}
        navGroups={navGroups}
        normalizedPath={normalizedPath}
      >
        <h1>Dashboard</h1>
      </AdminShell>
    )
  );
  return navGroups;
}

describe("Admin shell basePath regression", () => {
  it.each(["vi", "ja", "en"])("keeps every %s sidebar destination under /admin", async (locale) => {
    const navGroups = await render(locale);
    const items = navGroups.flatMap((group) => group.items);
    expect(items.find((item) => item.id === "ov.home")?.href).toBe(`/admin/${locale}`);
    expect(
      items.every(
        (item) => item.href.startsWith(`/admin/${locale}/`) || item.href === `/admin/${locale}`
      )
    ).toBe(true);
    expect(container.querySelector('nav a[aria-current="page"]')?.getAttribute("href")).toBe(
      `/admin/${locale}`
    );
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[title="Mở tất cả nhóm"]')!.click()
    );
    expect(
      [...container.querySelectorAll("nav a")].map((link) => link.getAttribute("href"))
    ).toEqual(items.filter((item) => !item.featureDisabled).map((item) => item.href));
  });

  it("keeps nested navigation expanded and active with the Admin prefix", async () => {
    await render("vi", "/dictionary/123");
    expect(container.querySelector('nav a[aria-current="page"]')?.getAttribute("href")).toBe(
      "/admin/vi/dictionary"
    );
  });

  it.each([
    ["vi", vietnamese.shell],
    ["ja", ja.shell],
    ["en", en.shell]
  ] as const)(
    "posts logout on a %s shell click before returning to its Admin login",
    async (locale, chrome) => {
      for (const index of [0, 1]) {
        await render(locale, "/", chrome);
        const signOut = [...container.querySelectorAll<HTMLAnchorElement>("a")].filter(
          (element) => element.textContent === chrome.signOut
        );
        expect(signOut).toHaveLength(2);
        expect(signOut[index].getAttribute("href")).toBe(`/admin/auth/logout?locale=${locale}`);
        fetchMock.mockClear();
        assignMock.mockClear();
        // Follow the native link into the actual logout page without jsdom navigation.
        document.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            routing.search = new URL(signOut[index].href).search;
            root.render(
              <StrictMode>
                <AdminLogoutPage />
              </StrictMode>
            );
          },
          { once: true }
        );
        await act(async () => signOut[index].click());
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/admin/logout",
          expect.objectContaining({
            method: "POST",
            credentials: "include"
          })
        );
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(assignMock).toHaveBeenCalledWith(`/admin/${locale}/login`);
        expect(fetchMock.mock.invocationCallOrder[0]).toBeLessThan(
          assignMock.mock.invocationCallOrder[0]
        );
      }
    }
  );

  it("waits for successful logout before redirecting", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        finish = resolve;
      })
    );
    routing.search = "locale=ja";
    await act(async () => root.render(<AdminLogoutPage />));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(assignMock).not.toHaveBeenCalled();
    expect(container.querySelector("main")?.getAttribute("aria-busy")).toBe("true");
    await act(async () => finish(new Response(null, { status: 204 })));
    expect(assignMock).toHaveBeenCalledWith("/admin/ja/login");
  });

  it.each([
    ["vi", vietnamese],
    ["ja", ja],
    ["en", en]
  ] as const)(
    "shows localized %s logout failure and retries without redirecting",
    async (locale, messages) => {
      fetchMock.mockResolvedValueOnce(new Response("private error", { status: 500 }));
      routing.search = `locale=${locale}`;
      await act(async () => root.render(<AdminLogoutPage />));
      expect(container.querySelector('[role="alert"]')?.textContent).toBe(
        messages.iam.adminManagement.errorMutation
      );
      expect(assignMock).not.toHaveBeenCalled();
      await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(assignMock).toHaveBeenCalledWith(`/admin/${locale}/login`);
    }
  );

  it("shows network failure and keeps the session destination unchanged", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network unavailable"));
    await act(async () => root.render(<AdminLogoutPage />));
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      vietnamese.iam.adminManagement.errorMutation
    );
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("falls back to vi for an unsupported logout locale", async () => {
    routing.search = "locale=https://evil.example";
    await act(async () => root.render(<AdminLogoutPage />));
    expect(assignMock).toHaveBeenCalledWith("/admin/vi/login");
  });
});
