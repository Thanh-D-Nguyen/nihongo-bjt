import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

import * as route from "./route";

const upstreamFetch = vi.fn();
vi.mock("../../../../lib/server-api-url", () => ({
  getServerApiBaseUrl: () => "http://api.local"
}));

beforeEach(() => {
  vi.stubGlobal("fetch", upstreamFetch);
  upstreamFetch.mockReset();
});

it("forwards authenticated appearance updates and the CSRF Origin to Go", async () => {
  const put = (route as typeof route & { PUT?: (request: NextRequest) => Promise<Response> }).PUT;
  expect(put).toBeTypeOf("function");
  if (!put) return;

  const body = JSON.stringify({
    themeMode: "dark",
    fontSizePreference: "large",
    densityPreference: "compact"
  });
  upstreamFetch.mockResolvedValue(new Response('{"themeMode":"dark"}', { status: 200 }));
  const request = new NextRequest("http://localhost/api/auth/me", {
    body,
    headers: {
      "content-type": "application/json",
      cookie: "bjt_web_session=real-session",
      origin: "http://localhost:18081"
    },
    method: "PUT"
  });

  const response = await put(request);

  expect(upstreamFetch).toHaveBeenCalledWith(
    "http://api.local/api/auth/me",
    expect.objectContaining({
      body,
      headers: expect.objectContaining({
        Cookie: "bjt_web_session=real-session",
        Origin: "http://localhost:18081",
        "Content-Type": "application/json"
      }),
      method: "PUT"
    })
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ themeMode: "dark" });
});

it("rejects profile updates without a learner session cookie", async () => {
  const put = (route as typeof route & { PUT?: (request: NextRequest) => Promise<Response> }).PUT;
  expect(put).toBeTypeOf("function");
  if (!put) return;

  const response = await put(
    new NextRequest("http://localhost/api/auth/me", {
      body: JSON.stringify({ themeMode: "dark" }),
      headers: { "content-type": "application/json", origin: "http://localhost:18081" },
      method: "PUT"
    })
  );

  expect(response.status).toBe(401);
  expect(upstreamFetch).not.toHaveBeenCalled();
});
