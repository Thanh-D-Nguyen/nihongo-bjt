import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("uses the server API URL when the browser API URL is intentionally empty", async () => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "");
  vi.stubEnv("API_URL", "http://127.0.0.1:4001");
  const fetchMock = vi.fn().mockImplementation(async () => new Response("[]", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const { default: page } = await import("./page");
  await page({ params: Promise.resolve({ locale: "vi", moduleKey: "audit_probe_module" }) });

  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "http://127.0.0.1:4001/api/daily-radar/modules",
    "http://127.0.0.1:4001/api/daily-radar/cards?moduleKey=audit_probe_module&limit=48"
  ]);
});
