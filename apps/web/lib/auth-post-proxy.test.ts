import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxyAuthPost } from "./auth-post-proxy";

const upstreamFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", upstreamFetch);
  upstreamFetch.mockReset();
});

it("rejects an oversized streamed body before buffering or forwarding it", async () => {
  let bytesPulled = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (bytesPulled === 8 * 1024 * 1024) {
        controller.close();
        return;
      }
      const chunk = new Uint8Array(1024);
      bytesPulled += chunk.byteLength;
      controller.enqueue(chunk);
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new NextRequest("http://localhost/api/auth/forgot-password", {
    body: stream,
    duplex: "half",
    headers: { "content-type": "application/json" },
    method: "POST",
  } as ConstructorParameters<typeof NextRequest>[1]);

  const response = await proxyAuthPost(request, "/api/auth/forgot-password");

  expect(response.status).toBe(413);
  expect(bytesPulled).toBeLessThanOrEqual(5120);
  expect(cancelled).toBe(true);
  expect(upstreamFetch).not.toHaveBeenCalled();
});
