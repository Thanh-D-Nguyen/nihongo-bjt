import { expect, test, type Page } from "@playwright/test";

test.use({ baseURL: "http://localhost:3000" });

const image = {
  handle: "signed-test-handle",
  provider: "Unsplash",
  url: "https://images.example.test/photo.png",
  sourceUrl: "https://unsplash.com/photos/test-photo",
  author: "Alice Example",
  authorUrl: "https://unsplash.com/@alice",
  license: "Unsplash License",
  licenseUrl: "https://unsplash.com/license"
};

async function openComposer(page: Page, failFirstSearch = false) {
  let searches = 0;
  const selections: unknown[] = [];
  const saves: unknown[] = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const localWeb = url.hostname === "localhost" && url.port === "3000";
    if (request.url() === image.url) {
      await route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") });
    } else if (url.pathname === "/api/auth/me" && localWeb) {
      await route.fulfill({ json: { id: "test-user", displayName: "Learner", email: "learner@example.test", status: "active" } });
    } else if (url.pathname.startsWith("/api/")) {
      const headers = { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true", "access-control-allow-methods": "GET, POST, PATCH, OPTIONS", "access-control-allow-headers": "content-type" };
      if (request.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers });
      } else if (url.pathname === "/api/media/search-images") {
        searches++;
        expect(request.postDataJSON()).toEqual({ query: "meeting" });
        await route.fulfill({ status: failFirstSearch && searches === 1 ? 503 : 200, headers, json: { results: [image] } });
      } else if (url.pathname === "/api/media/image-selections") {
        selections.push(request.postDataJSON());
        await route.fulfill({ headers, json: { assetId: "asset-test-1", status: "pending_review" } });
      } else if (url.pathname === "/api/flashcards/decks" && request.method() === "POST") {
        saves.push(request.postDataJSON());
        await route.fulfill({ headers, json: { id: "deck-test-1" } });
      } else {
        await route.fulfill({ headers, json: url.pathname === "/api/flashcards/decks" ? [] : {} });
      }
    } else if (localWeb) {
      await route.continue();
    } else {
      await route.abort();
    }
  });
  await page.goto("/en/flashcards");
  await page.getByRole("tab", { name: /Set creation/ }).filter({ visible: true }).click();
  await page.getByLabel("Deck name", { exact: true }).fill("Meetings");
  await page.getByPlaceholder("Front side — words/sentences…").first().fill("meeting");
  await page.getByPlaceholder("Behind the scenes — meaning/translation…").first().fill("conference");
  return { selections, saves, searchCount: () => searches };
}

test("credits a search result, selects it, and saves the asset ID", async ({ page }) => {
  const { selections, saves } = await openComposer(page);
  await expect(page.getByText("Photo from Unsplash")).toBeVisible();
  await expect(page.getByRole("link", { name: "Alice Example" })).toHaveAttribute("href", image.authorUrl);
  await expect(page.getByRole("link", { name: "Unsplash", exact: true })).toHaveAttribute("href", image.sourceUrl);
  await expect(page.getByRole("link", { name: "Unsplash License" })).toHaveAttribute("href", image.licenseUrl);
  const result = page.getByRole("button", { name: "Photo from Alice Example" });
  await expect(result.locator("img")).toBeVisible();
  await expect.poll(() => result.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await result.click();
  await expect.poll(() => selections).toEqual([{ handle: image.handle }]);
  await expect(result).toHaveClass(/ring-leaf\/30/);
  await page.getByRole("button", { name: "creation", exact: true }).first().click();
  await expect.poll(() => saves).toHaveLength(1);
  expect(saves[0]).toMatchObject({ titleVi: "Meetings", cards: [{ frontText: "meeting", backText: "conference", primaryImageAssetId: "asset-test-1" }] });
});

test("search error can be retried with the same query", async ({ page }) => {
  const { searchCount } = await openComposer(page, true);
  const search = page.locator('[aria-label="Card 1"]').getByRole("button", { name: "🔍 Find Image" });
  await expect(page.getByText("Image search failed. Please try again.")).toBeVisible();
  await search.click();
  await expect(page.getByRole("button", { name: "Photo from Alice Example" })).toBeVisible();
  await expect(page.getByText("Image search failed. Please try again.")).toHaveCount(0);
  expect(searchCount()).toBe(2);
});
