#!/usr/bin/env node
// Mobile-only pass + missing-desktop pass against warmed admin dev server.
// Place inside the workspace so node module resolution finds @playwright/test.
import { chromium } from "@playwright/test";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const baseURL = "http://127.0.0.1:3001";
const reviewLocale = "vi";
const adminUser = process.env.BROWSER_REVIEW_ADMIN_USERNAME;
const adminPass = process.env.BROWSER_REVIEW_ADMIN_PASSWORD;
const outDir = process.env.OUT_DIR;
if (!outDir) throw new Error("OUT_DIR required");
mkdirSync(outDir, { recursive: true });

function adminNavRoutes() {
  const source = readFileSync("apps/admin/lib/admin-nav-data.ts", "utf8");
  const hrefs = [...source.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
  return [...new Set(hrefs)].map((href) => {
    const p = href === "/" ? "" : href.startsWith("/") ? href : `/${href}`;
    return `/${reviewLocale}${p}`;
  });
}

function safe(route) {
  return route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";
}

const allRoutes = adminNavRoutes();
const existing = new Set(readdirSync(outDir));

async function login(page) {
  const url = new URL(`/${reviewLocale}/login`, baseURL);
  url.searchParams.set("returnTo", `/${reviewLocale}`);
  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.fill("#admin-login-username", adminUser);
  await page.fill("#admin-login-password", adminPass);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 60_000 }),
    page.click('button[type="submit"]')
  ]);
}

async function captureViewport(viewport, routes) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h } });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  await login(page);
  let captured = 0;
  for (const route of routes) {
    const fname = `${viewport.name}-${safe(route)}.png`;
    if (existing.has(fname)) continue;
    const url = new URL(route, baseURL).toString();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => {});
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(outDir, fname), fullPage: true });
      captured += 1;
      if (captured % 5 === 0) console.error(`[${viewport.name}] captured=${captured}/${routes.length}`);
    } catch (err) {
      console.error(`[${viewport.name}] FAIL ${url}: ${err.message}`);
    }
  }
  await browser.close().catch(() => {});
  return captured;
}

const desktopMissing = allRoutes.filter((r) => !existing.has(`desktop-${safe(r)}.png`));
const mobileMissing = allRoutes.filter((r) => !existing.has(`mobile-${safe(r)}.png`));

console.error(`desktopMissing=${desktopMissing.length} mobileMissing=${mobileMissing.length}`);

const desktopCount = await captureViewport({ name: "desktop", w: 1280, h: 800 }, desktopMissing);
console.error(`desktop done: +${desktopCount}`);
const mobileCount = await captureViewport({ name: "mobile", w: 375, h: 812 }, mobileMissing);
console.error(`mobile done: +${mobileCount}`);

console.log(JSON.stringify({ desktopAdded: desktopCount, mobileAdded: mobileCount }));
process.exit(0);
