import assert from "node:assert/strict";
import console from "node:console";
import fs from "node:fs";
import { URL } from "node:url";
import { chromium } from "@playwright/test";

/* global fetch, document */

const base = "http://localhost:18081";
const credentials = JSON.parse(fs.readFileSync("tmp/local-audit/audit-138-admin.json", "utf8"));
const browser = await chromium.launch({ headless: false });
const errors = [];
const requests = [];

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("status of 401 (Unauthorized)")) errors.push(message.text());
  });
  page.on("response", async response => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith("/api/admin/")) return;
    let body = null;
    try { body = await response.json(); } catch { /* Response can have no JSON body. */ }
    requests.push({ method: response.request().method(), path: url.pathname, status: response.status(), body });
  });

  await page.goto(`${base}/admin/vi/login?returnTo=%2Fadmin%2Fvi`);
  const anonymous = await page.evaluate(async () => (await fetch("/api/admin/magazine?locale=vi&limit=1")).status);
  assert.equal(anonymous, 401, "protected Magazine API rejects anonymous access");

  await page.locator('input[name="email"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => !url.pathname.includes("/login"), { timeout: 30_000 });
  const cookie = (await context.cookies(base)).find(item => item.name === "bjt_admin_session");
  assert.equal(cookie?.httpOnly, true, "real login creates an HttpOnly session cookie");
  assert.equal(await page.evaluate(async () => (await fetch("/api/admin/session")).status), 200);

  await page.goto(`${base}/admin/vi/magazine`);
  await page.getByRole("heading", { name: "Quản lý Magazine" }).waitFor();
  await page.waitForResponse(response => response.url().includes("/api/admin/magazine?") && response.status() === 200);
  await page.getByRole("button", { name: "Sinh nội dung", exact: true }).first().click();
  const dateInput = page.locator('input[type="date"]');
  await dateInput.waitFor({ state: "visible" });
  const date = new Date(Date.now() + (365 * 90 + (Date.now() % 365)) * 86_400_000).toISOString().slice(0, 10);
  await dateInput.fill(date);
  const generateResponsePromise = page.waitForResponse(response => response.url().includes("/api/admin/magazine/generate"));
  await page.getByRole("button", { name: "Sinh nội dung", exact: true }).last().click();
  const generateResponse = await generateResponsePromise;
  assert.equal(generateResponse.status(), 200, `Magazine generation failed: ${await generateResponse.text()}`);
  await page.getByText("Generated", { exact: true }).first().waitFor();
  const magazineWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const tableRegion = page.locator("table").locator("xpath=..");
  assert.ok(magazineWidth <= 390, `Magazine document overflowed mobile viewport: ${magazineWidth}px`);
  assert.equal(await tableRegion.getAttribute("role"), "region");
  assert.equal(await tableRegion.getAttribute("tabindex"), "0");
  await page.screenshot({ path: "/tmp/audit138-headed.png" });

  await page.goto(`${base}/admin/vi/magazine/loto-lab`);
  const drawsResponsePromise = page.waitForResponse(response => response.url().includes("/api/admin/magazine/loto/draws") && response.request().method() === "GET", { timeout: 5_000 }).catch(() => null);
  await page.getByRole("button", { name: /Dữ liệu/ }).click();
  const drawsResponse = await drawsResponsePromise;
  assert.ok(drawsResponse, `Loto Data tab made no draws request; buttons=${JSON.stringify(await page.getByRole("button").allInnerTexts())}; requests=${JSON.stringify(requests)}`);
  assert.equal(drawsResponse.status(), 200);
  const draws = await drawsResponse.json();
  assert.ok(Array.isArray(draws) && draws.every(row => row.game === "loto6" && "mainNumbers" in row && "drawNumber" in row));

  const autopilotResponse = await page.evaluate(async () => {
    const response = await fetch("/api/admin/magazine/loto/autopilot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ game: "loto6" }) });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(autopilotResponse.status, 200);
  assert.equal(autopilotResponse.body.status, "waiting_result");
  assert.equal(autopilotResponse.body.game, "loto6");

  const menu = page.getByRole("button", { name: "Menu" });
  if (await menu.isVisible()) await menu.click();
  const logoutResponsePromise = page.waitForResponse(response => new URL(response.url()).pathname === "/api/admin/logout");
  await page.getByRole("link", { name: "Đăng xuất" }).first().click();
  const logoutResponse = await logoutResponsePromise;
  assert.equal(logoutResponse.status(), 200);
  await page.waitForURL(url => url.pathname.includes("/login"), { timeout: 30_000 });
  const anonymousAfter = await page.evaluate(async () => (await fetch("/api/admin/magazine?locale=vi&limit=1")).status);
  assert.equal(anonymousAfter, 401, "logout revokes the Admin session");

  for (const request of requests) assert.ok(request.status < 500, `${request.method} ${request.path} returned ${request.status}`);
  assert.deepEqual(errors, [], "Admin browser has no console or page errors");
  const result = { anonymous_before_login: anonymous, admin_login: 200, httpOnly: cookie.httpOnly, magazine_list: 200, magazine_generate: 200, loto_draws: { status: drawsResponse.status(), rows: draws.length }, loto_autopilot: autopilotResponse, logout: 200, anonymous_after_logout: anonymousAfter, viewport: "390x844", magazine_document_width: magazineWidth, requests: requests.map(({ method, path, status }) => ({ method, path, status })), errors };
  fs.writeFileSync("tmp/local-audit/audit-138-result.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
