// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { DailyAdminClient } from "./daily-client";
import { adminApiFetch } from "@/lib/admin-api";
vi.mock("@/lib/admin-api", () => ({ adminApiFetch: vi.fn() }));

it("reports a partially failed NHK refresh instead of complete success", async () => {
  vi.mocked(adminApiFetch).mockImplementation(async (path) => {
    if (String(path).includes("/refresh")) return new Response(JSON.stringify({ easy: { count: 0 }, normal: { count: 2 }, errors: { easy: "unavailable" } }), { status: 207 });
    return new Response(JSON.stringify(String(path).includes("/config") ? { defaultType: "easy", easyEnabled: true, normalEnabled: true, easyFeedUrl: "", normalFeedUrl: "" } : []));
  });
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(() => root.render(<DailyAdminClient labels={en.daily} locale="en" />));
    const refresh = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === en.daily.nhkRefresh)!;
    await act(async () => refresh.click());
    expect(host.textContent).toContain(en.daily.error);
    expect(host.textContent).toContain("Normal: 2");
  } finally { await act(() => root.unmount()); }
});
