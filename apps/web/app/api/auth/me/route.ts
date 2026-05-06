import net from "node:net";
import { NextResponse } from "next/server";

import { resolveLearnerAccessForServer } from "@/lib/learner-access-resolve";
import { getLastServerApiResolution, getServerApiBaseUrl } from "@/lib/server-api-url";

export const dynamic = "force-dynamic";

/** Quick probe: is anything accepting TCP on this host:port (Nest down vs wrong URL). */
function tcpAcceptsConnections(host: string, port: number, ms = 400): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const finish = (ok: boolean) => {
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), ms);
    socket.once("connect", () => {
      clearTimeout(timer);
      finish(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      finish(false);
    });
    socket.connect(port, host);
  });
}

async function probeApiTcp(apiBase: string): Promise<{ host: string; port: number; open: boolean } | null> {
  try {
    const u = new URL(apiBase);
    const port = u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80;
    if (!Number.isFinite(port) || port <= 0) {
      return null;
    }
    const open = await tcpAcceptsConnections(u.hostname, port);
    return { host: u.hostname, port, open };
  } catch {
    return null;
  }
}

/**
 * Same-origin BFF: reads HttpOnly Keycloak cookies on the server and forwards to the Nest API.
 * Avoids cross-origin `/api/auth/me` from the browser (CORS / credential edge cases).
 */
export async function GET() {
  const apiBase = getServerApiBaseUrl();
  const resolved = await resolveLearnerAccessForServer();

  if (resolved.kind === "no_config") {
    return NextResponse.json({ error: "keycloak_not_configured" }, { status: 503 });
  }
  if (resolved.kind === "unauthorized") {
    return NextResponse.json({ error: resolved.reason }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBase}/api/auth/me`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${resolved.access}` }
    });
  } catch {
    const meta = getLastServerApiResolution();
    const tcp = await probeApiTcp(apiBase);
    const hintBase =
      "Ensure the Nest API is running on this host/port. From repo root use `pnpm dev` (web+api) or `pnpm dev:api` only the API. `localhost` in URLs is rewritten to `127.0.0.1` for server fetch. In Docker set `API_URL` (e.g. `http://api:4000`).";
    const hint =
      tcp && !tcp.open
        ? `${hintBase} TCP probe: nothing listening on ${tcp.host}:${tcp.port}.`
        : tcp?.open
          ? `${hintBase} TCP to ${tcp.host}:${tcp.port} succeeded but HTTP fetch failed — check TLS/path or API crash after accept.`
          : hintBase;

    const out = NextResponse.json(
      {
        error: "api_unreachable",
        attemptedUrl: `${apiBase}/api/auth/me`,
        resolvedFrom: meta?.source ?? "unknown",
        tcp: tcp ?? undefined,
        envHints: {
          API_URL: Boolean(process.env.API_URL?.trim()),
          WEB_API_URL: Boolean(process.env.WEB_API_URL?.trim()),
          INTERNAL_API_URL: Boolean(process.env.INTERNAL_API_URL?.trim()),
          NEXT_PUBLIC_API_URL: Boolean(process.env.NEXT_PUBLIC_API_URL?.trim())
        },
        hint
      },
      { status: 503 }
    );
    resolved.applyRefreshedCookies?.(out);
    return out;
  }

  const body = await upstream.text();
  const contentType = upstream.headers.get("content-type") ?? "application/json; charset=utf-8";
  const out = new NextResponse(body, { status: upstream.status, headers: { "content-type": contentType } });
  resolved.applyRefreshedCookies?.(out);
  return out;
}
