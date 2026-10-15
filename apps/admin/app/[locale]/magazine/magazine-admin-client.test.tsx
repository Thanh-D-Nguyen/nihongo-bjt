// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/admin-api", () => ({ adminApiFetch: mocks.apiFetch }));

import { MagazineAdminClient } from "./magazine-admin-client";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.apiFetch.mockResolvedValue(new Response(JSON.stringify({
    data: [{
      contentDate: "2026-10-13", createdAt: "2026-10-13T00:00:00Z", id: "article-1",
      jlptLevel: "N2", slug: "test-article", status: "draft", titleJp: "日本語のタイトル",
      titleVi: "Bản tin kiểm thử", widgetKind: "magazine_vocab"
    }], limit: 50, page: 1, total: 1
  })));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  mocks.apiFetch.mockReset();
  vi.unstubAllGlobals();
});

describe("Magazine mobile layout", () => {
  it("keeps the article table inside a keyboard-accessible horizontal scroll region", async () => {
    await act(async () => {
      root.render(<MagazineAdminClient labels={{ title: "Magazine", loading: "Loading" } as never} locale="vi" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const table = container.querySelector("table");
    const region = table?.parentElement;
    expect(region?.className).toContain("overflow-x-auto");
    expect(region?.getAttribute("role")).toBe("region");
    expect(region?.getAttribute("tabindex")).toBe("0");
    expect(region?.getAttribute("aria-label")).toBe("Magazine");
  });
});
