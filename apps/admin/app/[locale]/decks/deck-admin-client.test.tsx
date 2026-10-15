// @vitest-environment jsdom

import { act, Component, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/admin-api", () => ({ adminApiFetch: mocks.apiFetch }));
vi.mock("@/app/_components/admin-client-utils", () => ({
  downloadCsv: vi.fn(),
  permsFromMe: () => new Set(["admin.content.write"])
}));

import { downloadCsv } from "@/app/_components/admin-client-utils";
import { DeckAdminClient } from "./deck-admin-client";

let container: HTMLDivElement;
let root: Root;
let transitioned: boolean;

class TestErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? <div role="alert">Screen crashed</div> : this.props.children;
  }
}

beforeEach(() => {
  transitioned = false;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.apiFetch.mockImplementation((path: string) => {
    if (path === "/api/admin/me") return Promise.resolve(new Response(JSON.stringify({})));
    if (path.endsWith("/transition")) {
      transitioned = true;
      return Promise.resolve(new Response(JSON.stringify({ id: "00000000-0000-4000-8000-000000000001", status: "archived" })));
    }
    if (path.includes("/00000000-0000-4000-8000-000000000001")) {
      return Promise.resolve(new Response(JSON.stringify({
        audit: transitioned ? [{ action: "admin.flashcards.deck.rejected", createdAt: "2026-10-07T00:00:00Z", id: "audit-1", reason: "lý do thử nghiệm" }] : [],
        cardCount: 7, descriptionJa: "詳細", descriptionVi: "Mô tả deck",
        id: "00000000-0000-4000-8000-000000000001", status: transitioned ? "archived" : "active",
        titleVi: "Bộ thẻ kiểm thử", titleJa: "テスト", visibility: "public"
      })));
    }
    return Promise.resolve(new Response(JSON.stringify({
      items: [{
        cardCount: 7, id: "00000000-0000-4000-8000-000000000001", ownerUserId: "owner-1",
        status: "active", titleVi: "Bộ thẻ kiểm thử", titleJa: "テスト", updatedAt: "2026-10-07T00:00:00Z",
        visibility: "public"
      }], page: 1, pageSize: 50, total: 1
    })));
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  mocks.apiFetch.mockReset();
  vi.mocked(downloadCsv).mockReset();
  vi.unstubAllGlobals();
});

async function renderDecks() {
  await act(async () => {
    root.render(<TestErrorBoundary><DeckAdminClient labels={{}} /></TestErrorBoundary>);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("Admin deck API contract mapping", () => {
  it("shows the API cardCount in the table and detail drawer", async () => {
    await renderDecks();
    expect(container.querySelector("tbody tr")?.children[4]?.textContent).toBe("7");

    await act(async () => {
      container.querySelector("tbody tr")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("Mô tả deck");
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("7");
  });

  it("exports the API cardCount and ownerUserId fields", async () => {
    await renderDecks();
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "actionExportCsv")!.click();
    });

    expect(downloadCsv).toHaveBeenCalledWith(expect.any(String), expect.any(Array), [
      ["00000000-0000-4000-8000-000000000001", "Bộ thẻ kiểm thử", "テスト", "public", "active", "7", "owner-1", "2026-10-07T00:00:00Z"]
    ]);
  });

  it("keeps the deck table horizontally scrollable on narrow screens", async () => {
    await renderDecks();
    const table = container.querySelector("table");
    expect(table?.parentElement?.className).toContain("overflow-x-auto");
  });

  it("reloads the full detail after the status endpoint returns only id and status", async () => {
    await renderDecks();
    await act(async () => {
      container.querySelector("tbody tr")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>("[role=dialog] button")].find((button) => button.textContent === "reject")!.click();
    });
    await act(async () => {
      const input = container.querySelector("[role=dialog] input")!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "lý do thử nghiệm");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>("[role=dialog] button")].find((button) => button.textContent === "confirm")!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.apiFetch.mock.calls.map(([path]) => path).filter((path) => path.endsWith("/transition"))).toHaveLength(1);
    expect(mocks.apiFetch.mock.calls.map(([path]) => path).filter((path) => path === "/api/admin/flashcards/decks/00000000-0000-4000-8000-000000000001")).toHaveLength(2);
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("admin.flashcards.deck.rejected");
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("lý do thử nghiệm");
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("public · archived");
  });
});
