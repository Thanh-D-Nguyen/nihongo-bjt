/* global document -- used only inside page.evaluate, which runs in the browser */
import assert from "node:assert/strict";
import console from "node:console";
import fs from "node:fs";
import { URL } from "node:url";
import { chromium } from "@playwright/test";

// Headed Chromium, real Admin login form. Opens the Postcards create dialog, which triggers the debounced
// share-template preview, and checks that the rendered SVG appears. Nothing is submitted, so no rows are written.
const base = "http://localhost:18081";
const credentials = JSON.parse(fs.readFileSync("tmp/local-audit/audit-138-admin.json", "utf8"));
const errors = [];
const previews = [];
const browser = await chromium.launch({ headless: false });

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    timezoneId: "Asia/Tokyo"
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname === "/api/admin/growth/share-template/preview") {
      previews.push({ method: response.request().method(), status: response.status() });
    }
  });

  await page.goto(`${base}/admin/vi/login?returnTo=%2Fadmin%2Fvi%2Fgrowth%2Fpostcards`);
  await page.locator('input[name="email"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === "/admin/vi/growth/postcards", { timeout: 30_000 });

  const previewWait = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/admin/growth/share-template/preview",
    { timeout: 30_000 }
  );
  await page.getByRole("button", { name: "Tạo template", exact: true }).click();
  assert.equal((await previewWait).status(), 200, "preview POST returns 200");

  const image = page.locator('img[src^="data:image/svg+xml;base64,"]').first();
  await image.waitFor({ timeout: 30_000 });
  const rendered = await image.evaluate((element) => ({
    complete: element.complete,
    naturalWidth: element.naturalWidth,
    naturalHeight: element.naturalHeight
  }));
  assert.ok(rendered.complete && rendered.naturalWidth === 1200 && rendered.naturalHeight === 630, `SVG preview renders at 1200x630: ${JSON.stringify(rendered)}`);

  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  assert.ok(layout.scrollWidth <= layout.clientWidth, `dialog fits 390px: ${JSON.stringify(layout)}`);
  assert.deepEqual(errors, [], "no console or page errors");

  fs.writeFileSync(
    "tmp/local-audit/audit-149-browser-result.json",
    JSON.stringify({ viewport: "390x844", previews, rendered, layout, errors }, null, 2)
  );
  console.log(JSON.stringify({ viewport: "390x844", previews, rendered, layout, errors }));
  await context.close();
} finally {
  await browser.close();
}
