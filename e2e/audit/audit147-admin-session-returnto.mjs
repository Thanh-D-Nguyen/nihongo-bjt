import assert from "node:assert/strict";
import console from "node:console";
import fs from "node:fs";
import { URL } from "node:url";
import { chromium } from "@playwright/test";

// Headed Chromium, real Admin login form: an anonymous deep link must return to the same Admin route after sign-in.
const base = "http://localhost:18081";
const target = "/admin/vi/growth/campaigns";
const credentials = JSON.parse(fs.readFileSync("tmp/local-audit/audit-138-admin.json", "utf8"));
const errors = [];
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
    if (message.type() !== "error") return;
    // The anonymous session probe (GET /api/admin/session -> 401) is the designed gate behaviour; any other error fails.
    const source = message.location().url ? new URL(message.location().url).pathname : "";
    if (message.text().includes("status of 401") && source === "/api/admin/session") return;
    errors.push(message.text());
  });

  await page.goto(`${base}${target}`);
  await page.waitForURL((url) => url.pathname === "/admin/vi/login", { timeout: 30_000 });
  const returnTo = new URL(page.url()).searchParams.get("returnTo");
  assert.equal(returnTo, target, `login returnTo must be the full Admin path, got ${returnTo}`);

  await page.locator('input[name="email"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === target, { timeout: 30_000 });
  assert.equal(new URL(page.url()).pathname, target);
  await page.getByRole("button", { name: "Tạo chiến dịch", exact: true }).waitFor({ timeout: 30_000 });

  assert.deepEqual(errors, [], "no console or page errors");
  fs.writeFileSync(
    "tmp/local-audit/audit-147-browser-result.json",
    JSON.stringify({ viewport: "390x844", returnTo, landed: target, errors }, null, 2)
  );
  console.log(JSON.stringify({ viewport: "390x844", returnTo, landed: target, errors }));
  await context.close();
} finally {
  await browser.close();
}
