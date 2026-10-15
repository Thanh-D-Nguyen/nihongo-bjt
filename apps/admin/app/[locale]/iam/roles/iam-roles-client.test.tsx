// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/admin-api", () => ({ adminApiFetch: mocks.apiFetch }));

import { IamRolesClient } from "./iam-roles-client";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.apiFetch.mockImplementation((path: string) => Promise.resolve(new Response(JSON.stringify(
    path.includes("role-audit") ? [] : [{
      adminCount: 0,
      code: "iam.manage",
      createdAt: "2026-10-15T00:00:00Z",
      description: null,
      id: "role-1",
      name: "IAM Manager",
      permissionCount: 2,
      status: "active"
    }]
  ))));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  mocks.apiFetch.mockReset();
  vi.unstubAllGlobals();
});

describe("IAM roles mobile table", () => {
  it("keeps the wide role table in a keyboard-accessible horizontal scroller", async () => {
    await act(async () => {
      root.render(<IamRolesClient common={{ empty: "Empty", error: "Error", loading: "Loading", records: "Records" }} labels={{ title: "Roles" }} locale="vi" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const region = container.querySelector('[role="region"][aria-label="Roles"]');
    const table = container.querySelector("table");
    expect(region, "roles table needs a keyboard-accessible horizontal scroller").not.toBeNull();
    expect(region?.className).toContain("overflow-x-auto");
    expect(region?.getAttribute("tabindex")).toBe("0");
    expect(region?.contains(table)).toBe(true);
  });
});
