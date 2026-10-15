// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/admin-api", () => ({ adminApiFetch: mocks.apiFetch }));
vi.mock("@/app/_components/admin-client-utils", () => ({
  permsFromMe: () => new Set(["admin.content.write"])
}));
vi.mock("@/app/_components/admin-auto-fill", () => ({ AdminAutoFill: () => null }));

import { DailyRadarAdminClient } from "./daily-radar-admin-client";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.apiFetch.mockImplementation((path: string) => {
    if (path === "/api/admin/me") return Promise.resolve(new Response(JSON.stringify({})));
    if (path.includes("/summary")) {
      return Promise.resolve(new Response(JSON.stringify({
        archivedCards: 0, draftCards: 1, enabledModules: 1, publishedCards: 0,
        spotlight: null, totalModules: 1
      })));
    }
    if (path.includes("/modules")) {
      return Promise.resolve(new Response(JSON.stringify({ items: [{
        category: "news", defaultPriority: 0, descriptionVi: "", id: "module-1",
        isEnabled: true, isSpotlightEligible: false, moduleKey: "audit-module",
        moduleType: "content", routePath: null, status: "draft", titleJa: "", titleVi: "Bản tin",
        updatedAt: "2026-10-07T00:00:00Z", visualTheme: null
      }] })));
    }
    return Promise.resolve(new Response(JSON.stringify({ items: [{
      badgeTextVi: null, category: "news", ctaLabelVi: "Xem ngay", descriptionVi: "",
      estimatedMinutes: 5, id: "card-1", isPinned: false, isSpotlight: false,
      levelLabel: null, moduleConfigId: "module-1", moduleConfig: { moduleKey: "audit-module", titleVi: "Bản tin" },
      moduleType: "content", priority: 0, recommendationReasonVi: null, slug: "audit-card",
      status: "draft", targetRoute: null, titleVi: "Thẻ tin", updatedAt: "2026-10-07T00:00:00Z",
      visualTheme: null
    }] })));
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  mocks.apiFetch.mockReset();
  vi.unstubAllGlobals();
});

describe("Daily Radar mobile tables", () => {
  it("keeps cards and modules in independently scrollable wrappers", async () => {
    await act(async () => {
      root.render(<DailyRadarAdminClient common={{ empty: "Empty", error: "Error", loading: "Loading", records: "Records" }} labels={{}} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const tables = [...container.querySelectorAll("table")];
    expect(tables).toHaveLength(2);
    for (const table of tables) {
      expect(table.parentElement?.className).toContain("overflow-x-auto");
    }
  });
});
