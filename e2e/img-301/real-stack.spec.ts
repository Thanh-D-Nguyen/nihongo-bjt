import { expect, test } from "@playwright/test";
import pg from "pg";

test("real registration, provider search, selection and persisted deck image", async ({ page }) => {
  const api = process.env.IMG301_API_URL!;
  const db = new pg.Client({ connectionString: process.env.IMG301_DATABASE_URL });
  await db.connect();
  try {
    // Only the remote image bytes are substituted; all app and API traffic is real.
    await page.route("https://images.unsplash.com/fixture-photo", route => route.fulfill({
      contentType: "image/png",
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64")
    }));
    const anonymous = await page.request.post(`${api}/api/media/search-images`, { data: { query: "meeting" } });
    expect(anonymous.status()).toBe(401);
    await page.goto("/en/register");
    await expect(page.locator("#displayName")).toBeVisible();
    await page.locator("#displayName").fill("E2E Learner");
    await page.locator("#email").fill(`img301-${Date.now()}@example.test`);
    await page.locator("#password").fill("disposable-password-123");
    await page.locator("#confirmPassword").fill("disposable-password-123");
    const registration = page.waitForResponse(r => r.url().endsWith("/api/auth/register") && r.request().method() === "POST");
    await page.locator('button[type="submit"]').click();
    expect((await registration).status()).toBe(201);
    await page.waitForURL(url => !url.pathname.includes("register"));
    expect((await page.context().cookies()).some(c => c.name === "bjt_web_session" && c.httpOnly)).toBeTruthy();
    const searches: number[] = [];
    const failedRequests: string[] = [];
    const browserErrors: string[] = [];
    page.on("console", message => { if (message.type() === "error") browserErrors.push(message.text().includes("CORS") ? "CORS" : "browser error"); });
    page.on("requestfailed", request => {
      if (request.url().includes("/api/media/search-images")) failedRequests.push(request.failure()?.errorText ?? "unknown");
    });
    page.on("response", response => {
      if (response.url().endsWith("/api/media/search-images") && response.request().method() === "POST") searches.push(response.status());
    });
    await page.goto("/en/flashcards");
    await page.getByRole("tab", { name: /Set creation/ }).filter({ visible: true }).click();
    await page.getByLabel("Deck name", { exact: true }).fill("IMG 301 real stack");
    await page.getByPlaceholder("Front side — words/sentences…").first().fill("meeting");
    await page.getByPlaceholder("Behind the scenes — meaning/translation…").first().fill("conference");
    await page.locator('[aria-label="Card 1"]').getByRole("button", { name: "🔍 Find Image" }).click();
    await expect.poll(() => JSON.stringify({ searches, failedRequests, browserErrors }), { timeout: 10_000 }).toContain('"searches":[200');
    const image = page.getByRole("button", { name: "Photo from Fixture Photographer" });
    await expect(image).toBeVisible();
    expect(searches).toContain(200);
    const selection = page.waitForResponse(r => r.url().endsWith("/api/media/image-selections") && r.request().method() === "POST");
    await image.click();
    const selected = await selection;
    expect(selected.status()).toBe(201);
    const { assetId } = await selected.json();
    expect(assetId).toMatch(/^[0-9a-f-]{36}$/);
    const save = page.waitForResponse(r => r.url().endsWith("/api/flashcards/decks") && r.request().method() === "POST");
    await page.getByRole("button", { name: "creation", exact: true }).first().click();
    const saved = await save;
    expect(saved.ok()).toBeTruthy();
    const { id: deckId } = await saved.json();
    const persisted = await db.query(`SELECT a.id::text, a.provider, a.rights_status, a.owner_user_id::text,
      d.owner_user_id::text AS deck_owner, f.front_text, f.back_text
      FROM learning.deck d JOIN learning.deck_card dc ON dc.deck_id=d.id
      JOIN learning.flashcard_variant f ON f.id=dc.card_id
      JOIN learning.card_media_link l ON l.card_id=f.id AND l.role='primary_image'
      JOIN media.asset a ON a.id=l.asset_id WHERE d.id=$1 AND a.id=$2`, [deckId, assetId]);
    expect(persisted.rows).toHaveLength(1);
    expect(persisted.rows[0]).toMatchObject({ id: assetId, provider: "unsplash", rights_status: "pending_review", front_text: "meeting", back_text: "conference" });
    expect(persisted.rows[0].owner_user_id).toBe(persisted.rows[0].deck_owner);
    const detail = await page.request.get(`${api}/api/flashcards/decks/${deckId}`);
    expect(detail.status()).toBe(200);
    expect(JSON.stringify(await detail.json())).toContain(assetId);
  } finally {
    await db.end();
  }
});
