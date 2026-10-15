// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/admin-api", () => ({ adminApiFetch: mocks.apiFetch }));

import { IamPermissionsClient } from "./iam-permissions-client";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.apiFetch.mockResolvedValue(new Response(JSON.stringify([{
    adminCount: 0,
    code: "iam.manage",
    createdAt: "2026-10-15T00:00:00Z",
    description: "Manage identity access",
    group: "iam",
    id: "permission-1",
    roleCodes: [],
    roleCount: 0
  }])));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  mocks.apiFetch.mockReset();
  vi.unstubAllGlobals();
});

describe("IAM permissions mobile table", () => {
  it("keeps the wide permission table in a keyboard-accessible horizontal scroller", async () => {
    await act(async () => {
      root.render(<IamPermissionsClient common={{ empty: "Empty", error: "Error", loading: "Loading", records: "Records" }} labels={{ title: "Permissions" }} locale="vi" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const region = container.querySelector('[role="region"][aria-label="Permissions"]');
    const table = container.querySelector("table");
    expect(region, "permissions table needs a keyboard-accessible horizontal scroller").not.toBeNull();
    expect(region?.className).toContain("overflow-x-auto");
    expect(region?.getAttribute("tabindex")).toBe("0");
    expect(region?.contains(table)).toBe(true);
  });
});
