// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { DeckComposerPanel, type DeckComposerLabels } from "./deck-composer-panel";
import { learnerApiFetch } from "../../../../lib/learner-api";

vi.mock("next/navigation", () => ({ usePathname: () => "/en/flashcards", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../../../../lib/learner-api", () => ({ learnerApiFetch: vi.fn() }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const labels = new Proxy<Record<string, string>>({}, { get: (_, key) => String(key) }) as unknown as DeckComposerLabels;
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
async function render(mode: "create" | "edit" = "edit", asset?: string, secondCard = false) {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<DeckComposerPanel labels={labels} userId="u" mode={mode} onCancel={() => {}} onSuccess={() => {}} initialData={{ deckId: "d", titleVi: "Deck", visibility: "private", cards: [{ cardId: "c", deckCardId: "dc", frontText: "meeting", backText: "会議", reading: null, primaryImageAssetId: asset }, ...(secondCard ? [{ cardId: "c2", deckCardId: "dc2", frontText: "office", backText: "会社", reading: null }] : [])] }} />));
}
async function click(text: string) {
  const button = Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.includes(text));
  expect(button).toBeDefined();
  await act(async () => { button!.click(); });
}
afterEach(() => { if (root) act(() => root.unmount()); host?.remove(); vi.resetAllMocks(); });

it("uses theme-aware backgrounds and text for card fields", async () => {
  await render();
  for (const placeholder of ["composerTermPlaceholder", "composerReadingPlaceholder", "composerDefinitionPlaceholder"]) {
    const field = host.querySelector<HTMLElement>(`[placeholder="${placeholder}"]`);
    expect(field).not.toBeNull();
    expect(field!.classList.contains("bg-surface")).toBe(true);
    expect(field!.classList.contains("text-ink")).toBe(true);
  }
});

it("sends an explicit removal when editing a saved image", async () => {
  vi.mocked(learnerApiFetch).mockResolvedValue({ ok: true } as Response);
  await render("edit", "existing-asset");
  await click("composerRemoveImage");
  await click("composerSave");
  const [, request] = vi.mocked(learnerApiFetch).mock.calls[0]!;
  expect(JSON.parse(String(request?.body)).cards[0]).toMatchObject({ removePrimaryImage: true });
});

it.each([false, true])("preserves a saved image when a URL is entered and cleared; removal=%s", async (remove) => {
  vi.mocked(learnerApiFetch).mockResolvedValue({ ok: true } as Response);
  await render("edit", "existing-asset");
  const input = host.querySelector<HTMLInputElement>('input[type="url"]')!;
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => { setValue.call(input, "https://example.com/image.png"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  expect(Array.from(host.querySelectorAll("button")).some((button) => button.textContent === "composerRemoveImage")).toBe(true);
  await click("composerSave");
  expect(learnerApiFetch).not.toHaveBeenCalled();
  await act(async () => { setValue.call(input, ""); input.dispatchEvent(new Event("input", { bubbles: true })); });
  expect(Array.from(host.querySelectorAll("button")).some((button) => button.textContent === "composerRemoveImage")).toBe(true);
  if (remove) await click("composerRemoveImage");
  await click("composerSave");
  const card = JSON.parse(String(vi.mocked(learnerApiFetch).mock.calls[0]![1]?.body)).cards[0];
  if (remove) {
    expect(card.removePrimaryImage).toBe(true);
    expect(card.primaryImageAssetId).toBeUndefined();
  } else {
    expect(card.primaryImageAssetId).toBe("existing-asset");
    expect(card.removePrimaryImage).toBeUndefined();
  }
});

it.each(["create", "edit"] as const)("rejects direct image URLs on %s and saves after clearing them", async (mode) => {
  vi.mocked(learnerApiFetch).mockResolvedValue({ ok: true } as Response);
  await render(mode);
  const input = host.querySelector('input[type="url"]') as HTMLInputElement;
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => { setValue.call(input, "https://example.com/image.png"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  await click(mode === "edit" ? "composerSave" : "composerCreate");
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("composerImageUrlLabel");
  expect(learnerApiFetch).not.toHaveBeenCalled();
  await act(async () => { setValue.call(input, ""); input.dispatchEvent(new Event("input", { bubbles: true })); });
  await click(mode === "edit" ? "composerSave" : "composerCreate");
  expect(learnerApiFetch).toHaveBeenCalledWith(mode === "edit" ? "/api/flashcards/decks/d" : "/api/flashcards/decks", expect.objectContaining({ method: mode === "edit" ? "PATCH" : "POST" }));
});

it("replaces a pasted URL with an uploaded asset and saves it", async () => {
  vi.mocked(learnerApiFetch)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ assetId: "uploaded-asset", uploadUrl: "/upload", uploadToken: "token" }) } as Response)
    .mockResolvedValueOnce({ ok: true } as Response)
    .mockResolvedValueOnce({ ok: true } as Response);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  try {
    await render();
    const input = host.querySelector('input[type="url"]') as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => { setValue.call(input, "https://example.com/image.png"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    const fileInput = host.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, "files", { configurable: true, value: [new File(["image"], "image.png", { type: "image/png" })] });
    await act(async () => { fileInput.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(JSON.parse(String(vi.mocked(learnerApiFetch).mock.calls[0]![1]?.body))).toMatchObject({ purpose: "flashcard" });
    expect(input.value).toBe("");
    await click("composerSave");
    const [, request] = vi.mocked(learnerApiFetch).mock.calls[2]!;
    expect(JSON.parse(String(request?.body)).cards[0].primaryImageAssetId).toBe("uploaded-asset");
  } finally {
    vi.unstubAllGlobals();
  }
});

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}

async function uploadAt(index: number) {
  const input = host.querySelectorAll<HTMLInputElement>('input[type="file"]')[index]!;
  Object.defineProperty(input, "files", { configurable: true, value: [new File(["image"], "image.png", { type: "image/png" })] });
  await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
}

it.each(["reorder", "delete"])("attaches a delayed upload to its original row after %s", async (action) => {
  const pending = deferredResponse();
  vi.mocked(learnerApiFetch).mockReturnValueOnce(pending.promise).mockResolvedValue({ ok: true } as Response);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  try {
    await render("edit", undefined, true);
    await uploadAt(0);
    const selector = action === "reorder" ? '[aria-label="composerMoveRowDown"]' : '[aria-label="composerDeleteRowAria 1"]';
    await act(async () => { host.querySelector<HTMLButtonElement>(selector)!.click(); });
    await act(async () => { pending.resolve({ ok: true, json: async () => ({ assetId: "uploaded", uploadUrl: "/upload", uploadToken: "token" }) } as Response); });
    await click("composerSave");
    const request = vi.mocked(learnerApiFetch).mock.calls.find(([path]) => path === "/api/flashcards/decks/d")![1];
    const cards = JSON.parse(String(request?.body)).cards;
    expect(cards.find((card: { frontText: string }) => card.frontText === "office").primaryImageAssetId).toBeUndefined();
    if (action === "reorder") expect(cards.find((card: { frontText: string }) => card.frontText === "meeting").primaryImageAssetId).toBe("uploaded");
    else expect(cards).toHaveLength(1);
  } finally { vi.unstubAllGlobals(); }
});

it("blocks both submit buttons and the keyboard shortcut until every upload finishes", async () => {
  const first = deferredResponse();
  const second = deferredResponse();
  vi.mocked(learnerApiFetch).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockResolvedValue({ ok: true } as Response);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  try {
    await render("create", undefined, true);
    await uploadAt(0);
    await uploadAt(1);
    const submitButtons = Array.from(host.querySelectorAll("button")).filter((button) => ["composerCreate", "composerCreateAndPractice"].includes(button.textContent ?? ""));
    expect(submitButtons.length).toBeGreaterThan(0);
    expect(submitButtons.every((button) => button.disabled)).toBe(true);
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true })); });
    expect(learnerApiFetch).toHaveBeenCalledTimes(2);
    await act(async () => { first.resolve({ ok: true, json: async () => ({ assetId: "one", uploadUrl: "/upload", uploadToken: "token" }) } as Response); });
    expect(submitButtons.every((button) => button.disabled)).toBe(true);
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", metaKey: true })); });
    expect(vi.mocked(learnerApiFetch).mock.calls.some(([path]) => path === "/api/flashcards/decks")).toBe(false);
    await act(async () => { second.resolve({ ok: true, json: async () => ({ assetId: "two", uploadUrl: "/upload", uploadToken: "token" }) } as Response); });
    expect(submitButtons.every((button) => !button.disabled)).toBe(true);
    await click("composerCreate");
    const request = vi.mocked(learnerApiFetch).mock.calls.find(([path]) => path === "/api/flashcards/decks")![1];
    expect(JSON.parse(String(request?.body)).cards.map((card: { primaryImageAssetId: string }) => card.primaryImageAssetId)).toEqual(["one", "two"]);
  } finally { vi.unstubAllGlobals(); }
});

it("allows saving again after an upload fails", async () => {
  const pending = deferredResponse();
  vi.mocked(learnerApiFetch).mockReturnValueOnce(pending.promise).mockResolvedValue({ ok: true } as Response);
  await render();
  await uploadAt(0);
  const save = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "composerSave")!;
  expect(save.disabled).toBe(true);
  await act(async () => { pending.resolve({ ok: false } as Response); });
  expect(save.disabled).toBe(false);
  expect(host.textContent).toContain("error");
  await click("composerSave");
  expect(learnerApiFetch).toHaveBeenCalledWith("/api/flashcards/decks/d", expect.objectContaining({ method: "PATCH" }));
});

const unsplash = { handle: "signed-handle", provider: "unsplash", url: "https://images.unsplash.com/photo", sourceUrl: "https://unsplash.com/photos/1", author: "Alice", authorUrl: "https://unsplash.com/@alice", license: "Unsplash License" };

it.each(["upload", "selection"] as const)("locks image edits on the same row during a pending %s", async (operation) => {
  const pending = deferredResponse();
  vi.mocked(learnerApiFetch)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [unsplash] }) } as Response)
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValue({ ok: true } as Response);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  try {
    await render("edit", "original", true);
    await click("imgSearchBtn");
    const suggestion = host.querySelector<HTMLImageElement>('img[src="https://images.unsplash.com/photo"]')!.closest("button")!;
    if (operation === "upload") await uploadAt(0);
    else await act(async () => { suggestion.click(); });
    const row = host.querySelector<HTMLElement>('[aria-label="Card 1"]')!;
    const otherRow = host.querySelector<HTMLElement>('[aria-label="Card 2"]')!;
    const upload = row.querySelector<HTMLInputElement>('input[type="file"]')!;
    const url = row.querySelector<HTMLInputElement>('input[type="url"]')!;
    const remove = Array.from(row.querySelectorAll("button")).find((button) => button.textContent === "composerRemoveImage")!;
    const save = Array.from(host.querySelectorAll("button")).find((button) => button.textContent === "composerSave")!;
    expect([upload.disabled, url.disabled, remove.disabled, suggestion.disabled, save.disabled]).toEqual([true, true, true, true, true]);
    expect(otherRow.querySelector<HTMLInputElement>('input[type="file"]')!.disabled).toBe(false);
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true })); });
    expect(vi.mocked(learnerApiFetch).mock.calls.some(([path]) => path === "/api/flashcards/decks/d")).toBe(false);
    await act(async () => { pending.resolve(operation === "upload"
      ? { ok: true, json: async () => ({ assetId: "new-image", uploadUrl: "/upload", uploadToken: "token" }) } as Response
      : { ok: true, json: async () => ({ assetId: "new-image" }) } as Response); });
    expect([upload.disabled, url.disabled, remove.disabled, suggestion.disabled, save.disabled]).toEqual([false, false, false, false, false]);
    await act(async () => { remove.click(); });
    await click("composerSave");
    const request = vi.mocked(learnerApiFetch).mock.calls.find(([path]) => path === "/api/flashcards/decks/d")![1];
    expect(JSON.parse(String(request?.body)).cards[0]).toMatchObject({ removePrimaryImage: true });
  } finally { vi.unstubAllGlobals(); }
});

it("shows a retryable search failure and then an empty result", async () => {
  vi.mocked(learnerApiFetch).mockResolvedValueOnce({ ok: false, status: 503 } as Response).mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) } as Response);
  await render(); await click("imgSearchBtn");
  expect(host.textContent).toContain("imgSearchError");
  await click("imgSearchBtn");
  expect(host.textContent).toContain("imgSearchEmpty");
});

it("credits and selects an Unsplash image using only its signed handle", async () => {
  vi.mocked(learnerApiFetch).mockResolvedValueOnce({ ok: true, json: async () => ({ results: [unsplash] }) } as Response).mockResolvedValueOnce({ ok: true, json: async () => ({ assetId: "asset-1", status: "pending_review" }) } as Response).mockResolvedValueOnce({ ok: true } as Response);
  await render(); await click("imgSearchBtn");
  expect(host.querySelector('a[href="https://unsplash.com/@alice"]')).not.toBeNull();
  expect(host.querySelector('a[href="https://unsplash.com/photos/1"]')).not.toBeNull();
  const button = host.querySelector('img[src="https://images.unsplash.com/photo"]')?.closest("button");
  expect(button?.disabled).toBe(false);
  await act(async () => { button!.click(); });
  expect(learnerApiFetch).toHaveBeenNthCalledWith(2, "/api/media/image-selections", expect.objectContaining({ body: JSON.stringify({ handle: "signed-handle" }) }));
  await click("composerSave");
  const [, request] = vi.mocked(learnerApiFetch).mock.calls[2]!;
  expect(JSON.parse(String(request?.body)).cards[0].primaryImageAssetId).toBe("asset-1");
  expect(vi.mocked(learnerApiFetch).mock.calls.some(([path]) => path === "/api/media/proxy-image")).toBe(false);
});

it("keeps a failed selection retryable and shows an error", async () => {
  vi.mocked(learnerApiFetch).mockResolvedValueOnce({ ok: true, json: async () => ({ results: [unsplash] }) } as Response).mockResolvedValueOnce({ ok: false, status: 502 } as Response);
  await render(); await click("imgSearchBtn");
  const button = host.querySelector('img[src="https://images.unsplash.com/photo"]')?.closest("button");
  await act(async () => { button!.click(); });
  expect(host.textContent).toContain("imgSelectError");
  expect(button?.disabled).toBe(false);
  expect((host.querySelector('input[type="url"]') as HTMLInputElement).value).toBe("");
});

it("does not describe rate limiting as a paid quota", async () => {
  vi.mocked(learnerApiFetch).mockResolvedValue({ ok: false, status: 429 } as Response);
  await render(); await click("imgSearchBtn");
  expect(host.textContent).toContain("imgSearchRateLimit");
  expect(host.textContent).not.toContain("imgSearchQuotaCta");
});

it("prevents saving while selection is pending and reports selection rate limits", async () => {
  let finish!: (value: Response) => void;
  const pending = new Promise<Response>((resolve) => { finish = resolve; });
  vi.mocked(learnerApiFetch).mockResolvedValueOnce({ ok: true, json: async () => ({ results: [unsplash] }) } as Response).mockReturnValueOnce(pending);
  await render(); await click("imgSearchBtn");
  const image = host.querySelector('img[src="https://images.unsplash.com/photo"]')!;
  await act(async () => { image.closest("button")!.click(); });
  const save = Array.from(host.querySelectorAll("button")).find((b) => b.textContent === "composerSave");
  expect(save?.disabled).toBe(true);
  expect(host.textContent).toContain("imgSelecting");
  await act(async () => { finish({ ok: false, status: 429 } as Response); });
  expect(save?.disabled).toBe(false);
  expect(host.textContent).toContain("imgSearchRateLimit");
});

it("rejects unsigned search results", async () => {
  vi.mocked(learnerApiFetch).mockResolvedValue({ ok: true, json: async () => ({ results: [{ ...unsplash, handle: "" }] }) } as Response);
  await render(); await click("imgSearchBtn");
  expect(host.textContent).toContain("imgSearchError");
  expect(host.querySelector('img[src="https://images.unsplash.com/photo"]')).toBeNull();
  expect(learnerApiFetch).toHaveBeenCalledTimes(1);
});
