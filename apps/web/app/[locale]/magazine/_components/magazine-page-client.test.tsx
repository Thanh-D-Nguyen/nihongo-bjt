// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import viMessages from "../../../../messages/vi.json";

const mockPush = vi.hoisted(() => vi.fn());
let currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/vi/magazine",
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => currentSearchParams,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children?: ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { MagazinePageClient } from "./magazine-page-client";

/**
 * Canonical `kind` query values served by `GET /api/magazine?kind=...`.
 * Source of truth: `listMagazineHandler` in
 * `apps/api-go/internal/httpserver/handler_career_content_gamification_misc.go`
 * (switch cases: "", "all", "vocab", "weather", "horoscope", "loto", "bjt_phrase").
 */
const GO_API_KNOWN_MAGAZINE_KINDS = [
  "vocab",
  "weather",
  "horoscope",
  "loto",
  "bjt_phrase",
] as const;

const sampleBjtArticle = {
  id: "art-bjt-1",
  slug: "2026-10-26-bjt_phrase-vi",
  widgetKind: "magazine_bjt_phrase",
  titleJp: "恐れ入りますが",
  titleVi: "Xin phép làm phiền",
  summaryVi: "Mẫu câu lịch sự trong giao tiếp kinh doanh.",
  jlptLevel: "N2",
  publishDate: "2026-10-26",
  vocabWords: [{ word: "恐れ入る", reading: "おそれいる", meaning: "xin lỗi / cảm kích" }],
};

describe("MagazinePageClient filter and pagination kind contract", () => {
  const container = document.createElement("div");
  let root: ReturnType<typeof createRoot> | null = null;

  afterEach(async () => {
    if (root) {
      await act(() => root!.unmount());
      root = null;
    }
    mockPush.mockClear();
    currentSearchParams = new URLSearchParams();
    vi.restoreAllMocks();
  });

  it("pins filter chip kinds to the Go API listMagazineHandler kind set and keeps the BJT label unchanged", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    root = createRoot(container);
    await act(() => {
      root!.render(
        <MagazinePageClient
          articles={[sampleBjtArticle]}
          kind="all"
          locale="vi"
          page={1}
          totalPages={2}
          t={viMessages.magazine}
        />,
      );
    });

    const buttons = [...container.querySelectorAll<HTMLButtonElement>("button")];
    expect(buttons.length).toBe(GO_API_KNOWN_MAGAZINE_KINDS.length + 1);

    const pushedByLabel = new Map<string, string>();
    for (const button of buttons) {
      mockPush.mockClear();
      await act(() => {
        button.click();
      });
      const label = button.querySelectorAll("span")[1]?.textContent?.trim() ?? "";
      pushedByLabel.set(label, mockPush.mock.calls[0]?.[0] ?? "");
    }

    expect(
      pushedByLabel.get(viMessages.magazine.filterAll),
      "clicking All filter must navigate to clean /vi/magazine without a trailing '?'",
    ).toBe("/vi/magazine");

    expect(
      pushedByLabel.get("BJT"),
      "BJT filter chip must keep visible label 'BJT' and route to API kind bjt_phrase",
    ).toBe("/vi/magazine?kind=bjt_phrase");

    const emittedKinds = [...pushedByLabel.entries()]
      .filter(([label]) => label !== viMessages.magazine.filterAll)
      .map(([, href]) => new URL(href, "https://example.test").searchParams.get("kind"));

    expect(
      emittedKinds,
      "non-all filter chips must exactly match the Go API known kind set (never legacy 'bjt')",
    ).toEqual([...GO_API_KNOWN_MAGAZINE_KINDS]);
    expect(emittedKinds).not.toContain("bjt");
  });

  it("normalizes legacy kind=bjt in active chip state, pagination hrefs, and card metadata", async () => {
    root = createRoot(container);
    const legacyWidgetArticle = {
      ...sampleBjtArticle,
      id: "art-bjt-legacy",
      slug: "2026-10-25-bjt-legacy",
      widgetKind: "bjt",
    };

    await act(() => {
      root!.render(
        <MagazinePageClient
          articles={[sampleBjtArticle, legacyWidgetArticle]}
          kind="bjt"
          locale="vi"
          page={1}
          totalPages={3}
          t={viMessages.magazine}
        />,
      );
    });

    const bjtButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (btn) => btn.textContent?.includes("BJT"),
    );
    expect(bjtButton, "BJT filter chip must be rendered").toBeDefined();
    expect(
      bjtButton!.className,
      "BJT chip must be marked active when legacy kind='bjt' is supplied",
    ).toContain("bg-action");

    const paginationLinks = [...container.querySelectorAll<HTMLAnchorElement>("nav a")].map((a) =>
      a.getAttribute("href"),
    );
    expect(paginationLinks.length).toBeGreaterThan(0);
    expect(
      paginationLinks,
      "pagination links must emit canonical kind=bjt_phrase rather than legacy kind=bjt",
    ).toContain("/vi/magazine?kind=bjt_phrase&page=2");
    for (const href of paginationLinks) {
      expect(href).not.toContain("kind=bjt&");
      expect(href).not.toMatch(/kind=bjt$/);
    }

    const articleLinks = [...container.querySelectorAll<HTMLAnchorElement>('a[href^="/vi/magazine/2026-"]')];
    expect(articleLinks).toHaveLength(2);
    for (const card of articleLinks) {
      expect(card.textContent, "both magazine_bjt_phrase and legacy bjt cards must show the BJT icon").toContain("💼");
    }
  });
});
