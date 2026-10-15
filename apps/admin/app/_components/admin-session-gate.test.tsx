// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// usePathname() reports the path without the Next.js basePath (/admin), exactly as Next does at runtime.
let pathname = "/vi/growth/campaigns";
const replace = vi.fn();
// Next returns a stable router object; a fresh one per render would retrigger the gate effect.
const router = { replace };
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => router
}));
vi.mock("@/lib/admin-api", () => ({ adminApiFetch: vi.fn() }));

import { adminApiFetch } from "@/lib/admin-api";
import { AdminSessionGate } from "./admin-session-gate";

describe("AdminSessionGate", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    replace.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.mocked(adminApiFetch).mockReset();
    vi.unstubAllGlobals();
  });

  it("redirects an expired session to login with the full Admin path, including the basePath", async () => {
    vi.mocked(adminApiFetch).mockResolvedValue(new Response(null, { status: 401 }));
    pathname = "/vi/growth/campaigns";

    await act(async () => {
      root.render(
        <AdminSessionGate busyLabel="Loading" locale="vi">
          <p>protected</p>
        </AdminSessionGate>
      );
    });

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/vi/login?returnTo=%2Fadmin%2Fvi%2Fgrowth%2Fcampaigns");
  });

  it("renders protected children without redirecting when the session is valid", async () => {
    vi.mocked(adminApiFetch).mockResolvedValue(new Response(null, { status: 200 }));
    pathname = "/vi/growth/campaigns";

    await act(async () => {
      root.render(
        <AdminSessionGate busyLabel="Loading" locale="vi">
          <p>protected</p>
        </AdminSessionGate>
      );
    });

    expect(replace).not.toHaveBeenCalled();
    expect(container.textContent).toContain("protected");
  });
});
