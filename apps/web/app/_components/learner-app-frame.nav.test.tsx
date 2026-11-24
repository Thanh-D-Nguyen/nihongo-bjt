// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import viMessages from "../../messages/vi.json";

const { auth, pathnameRef, reviewResponseRef, routerMock } = vi.hoisted(() => ({
  auth: { isAuthenticated: false },
  pathnameRef: { current: "/vi" },
  reviewResponseRef: { items: [] as unknown[] },
  routerMock: { push: vi.fn() }
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
  useRouter: () => routerMock
}));
vi.mock("../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({
    displayName: "Learner",
    email: "learner@example.com",
    isAuthenticated: auth.isAuthenticated,
    loading: false,
    logout: vi.fn()
  })
}));
vi.mock("../../lib/learner-api", () => ({
  learnerApiFetchOptional: vi.fn(async () =>
    new Response(JSON.stringify(reviewResponseRef.items), { status: 200 })
  )
}));
vi.mock("./announcement-strip", () => ({ AnnouncementStrip: () => null }));
vi.mock("./companion-bot", () => ({ CompanionBot: () => null }));
vi.mock("./search-dropdown", () => ({ SearchDropdown: () => null }));

import { LearnerAppFrame, type LearnerNavLabels } from "./learner-app-frame";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  vi.stubGlobal("matchMedia", (query: string) => ({
    addEventListener: vi.fn(),
    matches: false,
    media: query,
    removeEventListener: vi.fn()
  }));
  auth.isAuthenticated = false;
  pathnameRef.current = "/vi";
  reviewResponseRef.items = [];
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function renderFrame() {
  await act(async () => {
    root.render(
      <LearnerAppFrame
        companionLabels={viMessages.nav.companion}
        locale="vi"
        nav={viMessages.nav as unknown as LearnerNavLabels}
        searchLabels={viMessages.search}
      >
        <p>content</p>
      </LearnerAppFrame>
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function getDesktopNavLinks() {
  return [...host.querySelectorAll<HTMLAnchorElement>("header nav a")];
}

function getMobileBottomNavLinks() {
  const navs = [...host.querySelectorAll<HTMLElement>('nav[aria-label="Điều hướng chính"]')];
  const bottomNav = navs.find((el) => !el.closest("header") && !el.closest("footer"));
  return bottomNav ? [...bottomNav.querySelectorAll<HTMLAnchorElement>("a")] : [];
}

describe("LearnerAppFrame 5-item canonical navigation", () => {
  it("renders the exact 5 primary items identically on desktop header and mobile bottom bar, removes Khám phá dropdown, mobile hamburger, and /analytics, and updates footer learning links", async () => {
    auth.isAuthenticated = true;
    await renderFrame();

    const expectedHrefs = [
      "/vi",
      "/vi/levels",
      "/vi/flashcards",
      "/vi/quiz",
      "/vi/search"
    ];
    const expectedLabels = ["Trang chủ", "Học tập", "Ôn tập", "Luyện thi", "Tra cứu"];

    const desktopLinks = getDesktopNavLinks();
    expect(
      desktopLinks.map((a) => a.getAttribute("href")),
      "desktop primary nav must render the exact 5 canonical hrefs"
    ).toEqual(expectedHrefs);
    expect(
      desktopLinks.map((a) => a.textContent?.trim()),
      "desktop primary nav must render the exact 5 canonical labels"
    ).toEqual(expectedLabels);

    const mobileLinks = getMobileBottomNavLinks();
    expect(
      mobileLinks.map((a) => a.getAttribute("href")),
      "mobile bottom bar must render the exact 5 canonical hrefs"
    ).toEqual(expectedHrefs);
    expect(
      mobileLinks.map((a) => a.textContent?.trim()),
      "mobile bottom bar must render the exact 5 canonical labels"
    ).toEqual(expectedLabels);

    // No Khám phá dropdown or mobile hamburger menu; only the signed-in user avatar menu button remains
    const menuButtons = [...host.querySelectorAll<HTMLButtonElement>('header button[aria-haspopup="menu"]')];
    expect(menuButtons, "only the top-right user avatar menu button may remain in header").toHaveLength(1);
    expect(host.querySelector('header button[aria-label="Khám phá"]')).toBeNull();
    expect(host.querySelector('a[href="/vi/analytics"]')).toBeNull();
    expect(host.querySelector('a[href="/vi/explore"]')).toBeNull();

    // Opening avatar dropdown preserves /me and /daily-standup (WEB-442 owns /daily-standup removal)
    await act(async () => menuButtons[0]!.click());
    expect(host.querySelector('header a[href="/vi/me"]')).not.toBeNull();
    expect(host.querySelector('header a[href="/vi/daily-standup"]')).not.toBeNull();

    // Footer learning links match the 5 pillars + Gói dịch vụ (/pricing)
    const footerHrefs = [...host.querySelectorAll<HTMLAnchorElement>("footer nav a")].map((a) =>
      a.getAttribute("href")
    );
    expect(footerHrefs).toEqual(
      expect.arrayContaining([
        "/vi",
        "/vi/levels",
        "/vi/flashcards",
        "/vi/quiz",
        "/vi/search",
        "/vi/pricing"
      ])
    );
    expect(footerHrefs).not.toContain("/vi/analytics");
  });

  it("routes Ôn tập to /flashcards?tab=review with due badge when dueCount > 0 and highlights nested routes across all 5 pillars", async () => {
    auth.isAuthenticated = true;
    reviewResponseRef.items = Array.from({ length: 7 }, (_, idx) => ({ id: idx + 1 }));
    pathnameRef.current = "/vi/flashcards";
    await renderFrame();

    const desktopLinks = getDesktopNavLinks();
    const mobileLinks = getMobileBottomNavLinks();
    expect(
      desktopLinks[2]?.getAttribute("href"),
      "desktop Ôn tập must route to /vi/flashcards?tab=review when dueCount > 0"
    ).toBe("/vi/flashcards?tab=review");
    expect(
      mobileLinks[2]?.getAttribute("href"),
      "mobile Ôn tập must route to /vi/flashcards?tab=review when dueCount > 0"
    ).toBe("/vi/flashcards?tab=review");
    expect(desktopLinks[2]?.textContent).toContain("7");
    expect(mobileLinks[2]?.textContent).toContain("7");
    expect(desktopLinks[2]?.getAttribute("aria-current")).toBe("page");
    expect(mobileLinks[2]?.getAttribute("aria-current")).toBe("page");

    const activeIndexCases: Array<[string, number]> = [
      ["/vi", 0],
      ["/vi/levels/J3", 1],
      ["/vi/scenarios/sc-1", 1],
      ["/vi/news/nhk-1", 1],
      ["/vi/radar/card-1", 1],
      ["/vi/quiz", 3],
      ["/vi/exercises", 3],
      ["/vi/battle", 3],
      ["/vi/search", 4],
      ["/vi/dictionary/lex-1", 4],
      ["/vi/kanji/日", 4],
      ["/vi/grammar/g-1", 4],
      ["/vi/saved", 4]
    ];

    for (const [route, expectedActiveIdx] of activeIndexCases) {
      pathnameRef.current = route;
      await renderFrame();
      const dLinks = getDesktopNavLinks();
      const mLinks = getMobileBottomNavLinks();
      expect(
        dLinks.map((a) => a.getAttribute("aria-current") === "page"),
        `desktop active state for ${route}`
      ).toEqual(dLinks.map((_, idx) => idx === expectedActiveIdx));
      expect(
        mLinks.map((a) => a.getAttribute("aria-current") === "page"),
        `mobile active state for ${route}`
      ).toEqual(mLinks.map((_, idx) => idx === expectedActiveIdx));
    }
  });
});
