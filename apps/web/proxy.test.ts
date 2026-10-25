import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";

function rootRequest(acceptLanguage?: string) {
  const headers = acceptLanguage ? { "accept-language": acceptLanguage } : undefined;
  return new NextRequest("https://kiokoto.com/?ref=abc", { headers });
}

describe("proxy", () => {
  it("redirects with 307 to the browser locale and keeps the query string", () => {
    const response = proxy(rootRequest("ja-JP,ja;q=0.9,en;q=0.8"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://kiokoto.com/ja?ref=abc");
  });

  it("falls back to /vi and varies the response on Accept-Language", () => {
    const response = proxy(rootRequest("fr-FR,de;q=0.8"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://kiokoto.com/vi?ref=abc");
    expect(response.headers.get("vary")).toBe("Accept-Language");
  });

  it("falls back to /vi when the browser sends no Accept-Language header", () => {
    const response = proxy(rootRequest());

    expect(response.headers.get("location")).toBe("https://kiokoto.com/vi?ref=abc");
  });

  it("pins the matcher to the site root", () => {
    expect(config.matcher).toBe("/");
  });
});
