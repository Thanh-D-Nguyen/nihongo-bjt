// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../messages/en.json";
import ja from "../../messages/ja.json";
import vi_ from "../../messages/vi.json";

const { auth, prefersDark } = vi.hoisted(() => ({
  auth: { isAuthenticated: false },
  prefersDark: { value: false }
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/vi", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({ isAuthenticated: auth.isAuthenticated, loading: false, displayName: "Learner", email: null, logout: vi.fn() })
}));
vi.mock("../../lib/learner-api", () => ({
  learnerApiFetchOptional: vi.fn(async () => new Response("[]", { status: 200 }))
}));
vi.mock("./announcement-strip", () => ({ AnnouncementStrip: () => null }));
vi.mock("./companion-bot", () => ({ CompanionBot: () => null }));
vi.mock("./search-dropdown", () => ({ SearchDropdown: () => null }));

import { LearnerAppFrame } from "./learner-app-frame";

type NavWithTheme = typeof vi_.nav & { themeToggleToDark?: string; themeToggleToLight?: string };
const nav = vi_.nav as NavWithTheme;

let root: Root;
let host: HTMLDivElement;
const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: prefersDark.value,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("data-theme");
  auth.isAuthenticated = false;
  prefersDark.value = false;
  fetchMock.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function renderFrame() {
  await act(async () => {
    root.render(
      <LearnerAppFrame companionLabels={vi_.nav.companion} locale="vi" nav={nav} searchLabels={vi_.search}>
        <p>content</p>
      </LearnerAppFrame>
    );
  });
  await act(async () => { await Promise.resolve(); });
}

function toggle(label: string | undefined) {
  return host.querySelector<HTMLButtonElement>(`header button[aria-label="${label}"]`);
}

function storedTheme() {
  const raw = window.localStorage.getItem("nihongo-appearance");
  return raw ? (JSON.parse(raw) as { theme?: string }).theme : undefined;
}

describe("LearnerAppFrame header theme toggle", () => {
  it("lets guests switch between explicit light and dark themes through the appearance store", async () => {
    await renderFrame();
    const toDark = toggle(nav.themeToggleToDark);
    expect(toDark, "header must render a light/dark theme toggle for guests").not.toBeNull();

    await act(async () => toDark!.click());
    expect({
      dark: document.documentElement.classList.contains("dark"),
      dataTheme: document.documentElement.getAttribute("data-theme"),
      stored: storedTheme()
    }, "toggling to dark must apply .dark/data-theme and persist an explicit dark choice").toEqual({ dark: true, dataTheme: "dark", stored: "dark" });

    const toLight = toggle(nav.themeToggleToLight);
    expect(toLight, "after switching to dark the toggle must offer light").not.toBeNull();
    await act(async () => toLight!.click());
    expect({
      dark: document.documentElement.classList.contains("dark"),
      dataTheme: document.documentElement.getAttribute("data-theme"),
      stored: storedTheme()
    }).toEqual({ dark: false, dataTheme: "light", stored: "light" });
    expect(fetchMock, "guest theme choices stay local").not.toHaveBeenCalled();
  });

  it("overrides a dark system preference with an explicit light choice", async () => {
    prefersDark.value = true;
    document.documentElement.classList.add("dark");
    await renderFrame();
    const toLight = toggle(nav.themeToggleToLight);
    expect(toLight, "header toggle must reflect the resolved system dark theme").not.toBeNull();
    await act(async () => toLight!.click());
    expect({ dark: document.documentElement.classList.contains("dark"), stored: storedTheme() }).toEqual({ dark: false, stored: "light" });
  });

  it("persists a signed-in learner's toggle through the settings profile endpoint", async () => {
    auth.isAuthenticated = true;
    await renderFrame();
    const toDark = toggle(nav.themeToggleToDark);
    expect(toDark, "header must render the theme toggle for signed-in learners").not.toBeNull();
    await act(async () => toDark!.click());
    await act(async () => { await Promise.resolve(); });
    const call = fetchMock.mock.calls.find((args) => (args as unknown[])[0] === "/api/auth/me" && ((args as unknown[])[1] as RequestInit | undefined)?.method === "PUT") as unknown as [string, RequestInit] | undefined;
    expect(call, "signed-in toggle must persist via PUT /api/auth/me").toBeTruthy();
    expect(JSON.parse(String(call![1].body))).toEqual({ themeMode: "dark", fontSizePreference: "default", densityPreference: "comfortable" });
  });

  it("ships localized accessible labels for the toggle in vi, ja and en", () => {
    for (const messages of [vi_, ja, en]) {
      const labels = messages.nav as NavWithTheme;
      expect([labels.themeToggleToDark, labels.themeToggleToLight].every((value) => typeof value === "string" && value.length > 0), "theme toggle labels must exist in every locale").toBe(true);
    }
  });
});
