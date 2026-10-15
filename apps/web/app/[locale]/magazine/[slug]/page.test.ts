import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

import MagazineArticlePage from "./page";

afterEach(() => vi.unstubAllGlobals());

describe("magazine article loading", () => {
  it("treats only a missing article as not found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404 })));
    await expect(MagazineArticlePage({ params: Promise.resolve({ locale: "vi", slug: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("surfaces upstream and network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    await expect(MagazineArticlePage({ params: Promise.resolve({ locale: "vi", slug: "article" }) })).rejects.toThrow("503");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(MagazineArticlePage({ params: Promise.resolve({ locale: "vi", slug: "article" }) })).rejects.toThrow("offline");
  });
});
