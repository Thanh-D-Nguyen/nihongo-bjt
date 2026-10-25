import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const upstream = vi.fn();
beforeEach(() => { vi.stubGlobal("fetch", upstream); upstream.mockReset(); });

function request(origin = "http://localhost", token = "signed-id-token", forwardedFor?: string) {
  return new NextRequest("http://localhost/api/auth/google", {
    method: "POST",
    headers: { "content-type": "application/json", origin, ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}) },
    body: JSON.stringify({ idToken: token })
  });
}

it("rejects cross-origin submissions without forwarding the ID token", async () => {
  const response = await POST(request("https://malicious.example"));
  expect(response.status).toBe(403);
  expect(upstream).not.toHaveBeenCalled();
});

it("forwards same-origin Google credentials and returns only the secure cookie", async () => {
  upstream.mockResolvedValue(new Response(JSON.stringify({ ok: true, token: "opaque-go-session" }), {
    status: 200,
    headers: { "set-cookie": "bjt_web_session=opaque-go-session; Path=/; HttpOnly; Secure; SameSite=Lax" }
  }));
  const response = await POST(request("http://localhost", "signed-id-token", "192.0.2.57"));
  expect(upstream).toHaveBeenCalledWith(expect.stringMatching(/\/api\/auth\/google$/), expect.objectContaining({
    method: "POST", body: '{"idToken":"signed-id-token"}', headers: expect.objectContaining({ Origin: "http://localhost", "X-Forwarded-For": "192.0.2.57" })
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
});

it("does not expose backend error messages or session tokens", async () => {
  upstream.mockResolvedValue(new Response('{"error":"sensitive details"}', { status: 409 }));
  const response = await POST(request());
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "google_login_failed" });
});
