import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const upstreamFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", upstreamFetch);
  upstreamFetch.mockReset();
});

it("reset-password BFF forwards the token-bearing body only to the Go endpoint and preserves its contract", async () => {
    upstreamFetch.mockResolvedValue(new Response('{"error":"invalid or expired token"}', { status: 400 }));
    const body = JSON.stringify({ password: "new-password-123", token: "opaque-reset-token" });
    const request = new NextRequest("http://localhost/api/auth/reset-password", {
      body,
      headers: { "content-type": "application/json", origin: "https://learner.example", "x-forwarded-for": "203.0.113.7, 198.51.100.4" },
      method: "POST",
    });

    const response = await POST(request);

    expect(upstreamFetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/auth\/reset-password$/), expect.objectContaining({
      body,
      headers: expect.objectContaining({ "X-Forwarded-For": "203.0.113.7, 198.51.100.4" }),
      method: "POST",
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid or expired token" });
});
