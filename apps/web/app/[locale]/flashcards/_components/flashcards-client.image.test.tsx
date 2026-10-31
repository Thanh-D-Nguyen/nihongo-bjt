// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { FlashcardsClient, type FlashcardLabels } from "./flashcards-client";

vi.mock("../../../../lib/go-auth-provider", () => ({ useGoAuth: () => ({ userId: "learner" }) }));
vi.mock("../../../../lib/offline-review-queue", () => ({
  drainForUser: async () => [], enqueueReview: vi.fn(), queueSizeForUser: async () => 0
}));
vi.mock("../../../../lib/learner-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../../lib/learner-api")>();
  return { ...original, learnerApiFetch: async (url: string) => url.includes("/reviews/due")
    ? { ok: true, json: async () => [{ id: "review", cardId: "card", state: "new", card: { id: "card", frontText: "仕事", backText: "work", reading: null }, primaryImage: { assetId: "image", mimeType: "image/png", readUrl: "/api/media/image/private-preview", provider: "pexels", sourceUrl: "https://www.pexels.com/photo/a/", author: "Alice", authorUrl: "javascript:alert(1)", license: "Pexels License" } }] }
    : { ok: false } };
});
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("shows selected review image, resolves API URLs and displays safe credits", async () => {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const labels = new Proxy<Record<string, string>>({}, { get: (_, key) => String(key) }) as unknown as FlashcardLabels;
  await act(async () => { root.render(<FlashcardsClient labels={labels} locale="en" />); });
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/u, "");
  expect(host.querySelector("img")?.getAttribute("src")).toBe(`${base}/api/media/image/private-preview`);
  const caption = host.querySelector("figcaption");
  expect(caption?.textContent).toContain("Alice");
  expect(caption?.textContent).toContain("Pexels License");
  expect(caption?.querySelector("a")?.getAttribute("href")).toBe("https://www.pexels.com/photo/a/");
  expect(caption?.querySelector('a[href^="javascript:"]')).toBeNull();
  await act(async () => root.unmount()); host.remove();
});
