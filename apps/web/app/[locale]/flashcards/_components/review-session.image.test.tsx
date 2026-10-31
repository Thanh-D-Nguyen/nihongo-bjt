// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewSession, type ReviewSessionLabels } from "./review-session";

vi.mock("../../../../lib/go-auth-provider", () => ({ useGoAuth: () => ({ userId: "user" }) }));
const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }));
vi.mock("../../../../lib/learner-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../lib/learner-api")>()),
  learnerApiFetch: fetchApi
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
const labels = new Proxy<Record<string, string>>(
  {},
  { get: (_, property) => String(property) }
) as unknown as ReviewSessionLabels;
const image = {
  assetId: "image",
  mimeType: "image/jpeg",
  readUrl: "/api/media/image/private-preview",
  provider: "Provider",
  sourceUrl: "https://example.com/source",
  author: "Alice",
  authorUrl: "https://example.com/author",
  license: "CC BY",
  licenseUrl: "https://example.com/license"
};
let host: HTMLDivElement;
let root: Root;

afterEach(() => {
  if (root) act(() => root.unmount());
  host?.remove();
  vi.clearAllMocks();
});

async function start(images: (typeof image | null)[]) {
  const cards = images.map((primaryImage, index) => ({
    id: `review-${index}`,
    cardId: `card-${index}`,
    card: {
      id: `card-${index}`,
      frontText: `仕事${index}`,
      backText: `work${index}`,
      reading: null
    },
    primaryImage,
    primaryAudio: null,
    state: "review"
  }));
  fetchApi.mockImplementation(async (path: string) => ({
    ok: true,
    json: async () => (path.includes("distractors") ? { items: ["other"] } : cards)
  }));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(<ReviewSession labels={labels} locale="en" onExit={() => {}} />)
  );
  await act(async () =>
    [...host.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("startSession"))
      ?.click()
  );
}

function assertImage() {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/u, "");
  expect(host.querySelector("img")?.getAttribute("src")).toBe(`${base}${image.readUrl}`);
  for (const [label, url] of [
    ["Provider", image.sourceUrl],
    ["Alice", image.authorUrl],
    ["CC BY", image.licenseUrl]
  ]) {
    const link = [...host.querySelectorAll("a")].find((item) => item.textContent === label);
    expect(link?.getAttribute("href")).toBe(url);
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.closest("button")).toBeNull();
  }
}

describe("review session image attribution", () => {
  it("resolves and credits images in flip, type, and match modes", async () => {
    await start([image, image, image]);
    assertImage();
    await act(async () => host.querySelector<HTMLImageElement>("img")?.closest("button")?.click());
    expect(
      host.querySelector<HTMLButtonElement>("button[aria-pressed]")?.getAttribute("aria-pressed")
    ).toBe("true");
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "3" })));
    assertImage();
    await act(async () =>
      [...host.querySelectorAll("button")]
        .find((button) => button.textContent === "typeSubmit")
        ?.click()
    );
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "3" })));
    assertImage();
  });

  it("renders external image URLs without empty attribution", async () => {
    await start([
      {
        ...image,
        readUrl: "https://example.com/image.jpg",
        provider: "",
        sourceUrl: "",
        author: "",
        authorUrl: "",
        license: "",
        licenseUrl: ""
      }
    ]);
    expect(host.querySelector("img")?.getAttribute("src")).toBe("https://example.com/image.jpg");
    expect(host.querySelector("figcaption")).toBeNull();
  });

  it("keeps unsafe credits as text and omits absent credits", async () => {
    await start([
      {
        ...image,
        sourceUrl: "javascript:alert(1)",
        authorUrl: "//evil.example",
        licenseUrl: "data:text/html,hi"
      },
      null
    ]);
    expect(host.querySelectorAll("a")).toHaveLength(0);
    expect(host.textContent).toContain("Provider");
    expect(host.textContent).toContain("Alice");
    expect(host.textContent).toContain("CC BY");
    await act(async () => host.querySelector<HTMLButtonElement>("button[aria-pressed]")?.click());
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "3" })));
    expect(host.querySelector("img")).toBeNull();
    expect(host.querySelector("figcaption")).toBeNull();
  });
});
