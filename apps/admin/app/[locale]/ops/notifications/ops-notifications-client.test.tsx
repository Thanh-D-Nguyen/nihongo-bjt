// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/admin-api", () => ({ adminApiFetch: mocks.apiFetch }));

import { OpsNotificationsClient } from "./ops-notifications-client";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.apiFetch.mockImplementation(async (path: string) => {
    if (path === "/api/admin/me") {
      return new Response(JSON.stringify({ roles: [{ role: { permissions: [{ permission: { code: "iam.manage" } }] } }] }));
    }
    if (path.startsWith("/api/admin/operations/broadcasts?")) {
      return new Response(JSON.stringify({ items: [], total: 0 }));
    }
    return new Response("{}", { status: 200 });
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  mocks.apiFetch.mockReset();
  vi.unstubAllGlobals();
});

describe("OpsNotificationsClient API methods", () => {
  it("creates broadcasts with POST to the collection endpoint", async () => {
    await act(async () => {
      root.render(<OpsNotificationsClient common={{ empty: "Empty", error: "Error", loading: "Loading", records: "Records" }} labels={{ actionCreate: "Create", confirm: "Confirm" }} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Create")?.click();
    });
    const inputs = container.querySelectorAll("input");
    const body = container.querySelector("textarea");
    await act(async () => {
      const setInput = (el: HTMLInputElement, value: string) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      };
      setInput(inputs[0], "Test broadcast");
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(body, "Test body");
      body?.dispatchEvent(new Event("input", { bubbles: true }));
      setInput(inputs[inputs.length - 1], "audit reason");
    });
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirm")?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mocks.apiFetch).toHaveBeenCalledWith("/api/admin/operations/broadcasts", expect.objectContaining({ method: "POST" }));
  });
});
