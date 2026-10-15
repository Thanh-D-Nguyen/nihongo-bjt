import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const upstreamFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", upstreamFetch);
  upstreamFetch.mockReset();
});

it("forgot-password BFF forwards the localized request to the Go recovery endpoint", async () => {
    upstreamFetch.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    const request = new NextRequest("http://localhost/api/auth/forgot-password", {
      body: JSON.stringify({ email: "learner@example.com", locale: "ja" }),
      headers: { "content-type": "application/json", origin: "https://learner.example", "x-forwarded-for": "203.0.113.7, 198.51.100.4" },
      method: "POST",
    });

    const response = await POST(request);

    expect(upstreamFetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/auth\/forgot-password$/), expect.objectContaining({
      body: JSON.stringify({ email: "learner@example.com", locale: "ja" }),
      headers: expect.objectContaining({ Origin: "https://learner.example", "X-Forwarded-For": "203.0.113.7, 198.51.100.4" }),
      method: "POST",
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
});
