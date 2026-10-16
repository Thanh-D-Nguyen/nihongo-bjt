/* global document, innerWidth */
// Real-browser release journey against a running stack (Caddy origin serving web, admin and API).
//
//   RELEASE_BASE_URL       origin under test, e.g. http://localhost:28081 (required)
//   RELEASE_LEARNER_FILE   JSON {email,password} of a learner account (required)
//   RELEASE_ADMIN_FILE     JSON {email,password} of an admin account (required)
//   RELEASE_REQUIRE_SUPER  "1" asserts the admin holds the "*" permission
//   RELEASE_HEADED         "1" shows the browser window
//   RELEASE_OUT_DIR        screenshots and result JSON (default tmp/release-evidence)
//
// Credentials are read from the given files only; nothing is printed.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const base = required("RELEASE_BASE_URL").replace(/\/$/u, "");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const learnerFile = readJson(required("RELEASE_LEARNER_FILE"));
const learner = learnerFile.learner ?? learnerFile;
const admin = readJson(required("RELEASE_ADMIN_FILE"));
const outDir = process.env.RELEASE_OUT_DIR ?? "tmp/release-evidence";
fs.mkdirSync(outDir, { recursive: true });
const messages = readJson("apps/web/messages/vi.json");

const browser = await chromium.launch({ headless: process.env.RELEASE_HEADED !== "1" });
const summary = { base, headed: process.env.RELEASE_HEADED === "1" };

try {
  // Learner journey at phone width: anonymous guard, real login, preference save + refresh, logout.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`${base}/vi/settings/reading`);
  await page.waitForURL(/\/vi\/login/u);
  assert.equal((await context.request.get(`${base}/api/auth/me`)).status(), 401);

  await page.locator("input[type=email]").fill(learner.email);
  await page.locator("input[type=password]").first().fill(learner.password);
  const login = page.waitForResponse((r) => r.url().endsWith("/api/auth/login") && r.request().method() === "POST");
  await page.locator("button[type=submit]").click();
  assert.equal((await login).status(), 200);
  await page.waitForURL(/\/settings\/reading/u);

  await page.locator("select").waitFor();
  const before = await context.request.get(`${base}/api/reading-assist/preferences`);
  assert.equal(before.status(), 200);
  const previous = await before.json();
  await page.waitForFunction((mode) => document.querySelector("select")?.value === mode, previous.displayMode);

  const next = previous.displayMode === "full_furigana" ? "hover" : "full_furigana";
  async function save(mode) {
    await page.locator("select").selectOption(mode);
    const response = page.waitForResponse((r) => r.url().includes("/api/reading-assist/preferences") && r.request().method() === "PUT");
    await page.getByRole("button", { name: messages.readingPage.savePrefs, exact: true }).click();
    assert.equal((await response).status(), 200);
  }
  await save(next);
  await page.reload();
  await page.waitForFunction((mode) => document.querySelector("select")?.value === mode, next);
  const after = await (await context.request.get(`${base}/api/reading-assist/preferences`)).json();
  assert.equal(after.displayMode, next);
  assert.equal(after.showRomaji, previous.showRomaji, "saving the display mode must preserve the romaji preference");
  await save(previous.displayMode);

  let navigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations += 1;
  });
  await page.waitForTimeout(60_000);
  assert.equal(navigations, 0, "settings page must stay stable (no redirect loop)");
  assert.deepEqual(pageErrors, []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no horizontal overflow at 390px");
  await page.screenshot({ path: path.join(outDir, "reading.png"), fullPage: true });
  assert.equal((await context.request.post(`${base}/api/auth/logout`, { headers: { Origin: base } })).status(), 200);
  assert.equal((await context.request.get(`${base}/api/auth/me`)).status(), 401);
  summary.learner = { anonymousGuard: true, realLogin: true, saveRefresh: true, romajiPreserved: true, mobile: true, stableMs: 60_000, mainFrameNavigations: navigations, logout: true };
  await context.close();

  // Admin journey: anonymous guard, real login, session persistence, IAM read.
  const adminContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const adminPage = await adminContext.newPage();
  assert.equal((await adminContext.request.get(`${base}/api/admin/session`)).status(), 401);
  await adminPage.goto(`${base}/admin/vi/login`);
  await adminPage.locator("input[name=email]").fill(admin.email ?? admin.Email);
  await adminPage.locator("input[name=password]").fill(admin.password ?? admin.Password);
  const adminLogin = adminPage.waitForResponse((r) => r.url().endsWith("/api/admin/login") && r.request().method() === "POST");
  await adminPage.locator("button[type=submit]").click();
  assert.equal((await adminLogin).status(), 200);
  await adminPage.waitForURL((url) => url.pathname === "/admin/vi");
  assert.equal((await adminContext.request.get(`${base}/api/admin/session`)).status(), 200);
  const me = await adminContext.request.get(`${base}/api/admin/me`);
  assert.equal(me.status(), 200);
  const identity = await me.json();
  const permissions = identity.permissions ?? identity.actor?.permissions;
  assert.ok(Array.isArray(permissions) && permissions.length > 0, "admin identity must list permissions");
  if (process.env.RELEASE_REQUIRE_SUPER === "1") assert.ok(permissions.includes("*"), "operator must hold the wildcard permission");
  assert.equal((await adminContext.request.get(`${base}/api/admin/actors`)).status(), 200);
  await adminPage.reload();
  assert.equal((await adminContext.request.get(`${base}/api/admin/session`)).status(), 200);
  await adminPage.screenshot({ path: path.join(outDir, "admin.png"), fullPage: true });
  summary.admin = { realLogin: true, refresh: true, iamRead: true, permissions };
  await adminContext.close();

  fs.writeFileSync(path.join(outDir, "browser-release-result.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
} finally {
  await browser.close();
}
