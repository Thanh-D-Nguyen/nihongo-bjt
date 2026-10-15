import { NextRequest, NextResponse } from "next/server";
import { getServerApiBaseUrl } from "./server-api-url";

const maxAuthBodyBytes = 4096;

async function readBoundedBody(req: NextRequest) {
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxAuthBodyBytes) {
    await req.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!req.body) return "";

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxAuthBodyBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function proxyAuthPost(req: NextRequest, endpoint: string) {
  try {
    const body = await readBoundedBody(req);
    if (body === null) return NextResponse.json({ error: "request too large" }, { status: 413 });
    const forwardedFor = req.headers.get("x-forwarded-for");

    const upstream = await fetch(`${getServerApiBaseUrl()}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: req.headers.get("origin") ?? "http://localhost:3000",
        ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}),
      },
      body,
    });
    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "Password recovery service unavailable" }, { status: 502 });
  }
}
