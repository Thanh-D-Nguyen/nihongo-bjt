import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import console from "node:console";
import fs from "node:fs";
import process from "node:process";
import { URL } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { chromium } from "@playwright/test";

/* global document */

dotenv.config({ override: true, quiet: true });
const base = "http://localhost:18081";
const credentials = JSON.parse(fs.readFileSync("tmp/local-audit/audit-138-admin.json", "utf8"));
const browser = await chromium.launch({ headless: false });
const errors = [];
const requests = [];
let runId = null;
const csvDrawNumber = 9_000_000 + Math.floor(Math.random() * 900_000);
const resultDrawNumber = csvDrawNumber + 1;
const drawNumbers = [csvDrawNumber, resultDrawNumber];

let runFailure;
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", async response => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith("/api/admin/")) return;
    let body = null;
    try { body = await response.json(); } catch { /* Some endpoints intentionally return no JSON. */ }
    requests.push({ method: response.request().method(), path: url.pathname, status: response.status(), body });
  });

  await page.goto(`${base}/admin/vi/login?returnTo=%2Fadmin%2Fvi`);
  await page.locator('input[name="email"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => !url.pathname.includes("/login"), { timeout: 30_000 });
  assert.equal((await context.cookies(base)).find(cookie => cookie.name === "bjt_admin_session")?.httpOnly, true);

  await page.goto(`${base}/admin/vi/magazine/loto-lab`);
  await page.getByRole("heading", { name: "Loto Lab" }).waitFor();
  await page.getByRole("button", { name: /Sinh số/ }).click();
  const generatePromise = page.waitForResponse(response => new URL(response.url()).pathname === "/api/admin/magazine/loto/generate");
  await page.getByRole("button", { name: /Sinh dãy số/ }).click();
  const generated = await generatePromise;
  assert.equal(generated.status(), 200, await generated.text());
  const generatedBody = await generated.json();
  runId = generatedBody.id;
  assert.ok(runId, "generation response includes persisted run ID");
  assert.equal(generatedBody.sets.length, 3);
  await page.getByText(/Kết quả sinh \(3 bộ\)/).waitFor({ timeout: 10_000 });

  await page.getByRole("button", { name: /Dữ liệu/ }).click();
  const fileInput = page.locator('input[type="file"]');
  const csvDate = new Date().toISOString().slice(0, 10);
  const csv = `${csvDrawNumber},${csvDate},1,2,3,4,5,6,7\n`;
  const importPromise = page.waitForResponse(response => new URL(response.url()).pathname === "/api/admin/magazine/loto/import-csv");
  await fileInput.setInputFiles({ name: "audit140.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  const imported = await importPromise;
  assert.equal(imported.status(), 200, await imported.text());
  assert.deepEqual(await imported.json(), { created: 1, updated: 0, total: 1 });
  await page.getByText(/Nhập thành công: 1 mới, 0 cập nhật/).waitFor();

  const predictionsPromise = page.waitForResponse(response => new URL(response.url()).pathname === "/api/admin/magazine/loto/predictions" && response.request().method() === "GET");
  await page.getByRole("button", { name: /Dự đoán/ }).click();
  const predictions = await predictionsPromise;
  assert.equal(predictions.status(), 200);
  assert.ok(Array.isArray((await predictions.json()).data));

  await page.getByRole("button", { name: /Kết quả/ }).click();
  await page.locator('input[type="number"]').fill(String(resultDrawNumber));
  await page.locator('input[type="date"]').fill(csvDate);
  await page.locator('input[type="text"]').nth(0).fill("1, 2, 3, 4, 5, 6");
  await page.locator('input[type="text"]').nth(1).fill("7");
  const resultPromise = page.waitForResponse(response => new URL(response.url()).pathname === "/api/admin/magazine/loto/predictions/results");
  await page.getByRole("button", { name: /Lưu kết quả/ }).click();
  const saved = await resultPromise;
  assert.equal(saved.status(), 200, await saved.text());
  assert.equal((await saved.json()).drawNumber, resultDrawNumber);
  await page.getByText("Đã lưu kết quả!", { exact: true }).waitFor();

  const analyticsPromise = page.waitForResponse(response => new URL(response.url()).pathname === "/api/admin/magazine/loto/predictions/analytics");
  await page.getByRole("button", { name: /Thống kê/ }).click();
  const analytics = await analyticsPromise;
  assert.equal(analytics.status(), 200);
  assert.equal((await analytics.json()).game, "loto6");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await page.screenshot({ path: "/tmp/audit140-admin-loto-390.png", fullPage: true });

  for (const [method, path] of [
    ["POST", "/api/admin/magazine/loto/generate"],
    ["POST", "/api/admin/magazine/loto/import-csv"],
    ["GET", "/api/admin/magazine/loto/predictions"],
    ["GET", "/api/admin/magazine/loto/predictions/analytics"],
    ["POST", "/api/admin/magazine/loto/predictions/results"],
  ]) assert.ok(requests.some(request => request.method === method && request.path === path && request.status === 200), `${method} ${path} did not return 200 from the real UI`);
  assert.deepEqual(errors, [], "headed Admin page has no console or page errors");
  fs.writeFileSync("tmp/local-audit/audit-140-result.json", JSON.stringify({ login: "real form + HttpOnly session", viewport: "390x844", documentWidth: 390, runId, csvDrawNumber, resultDrawNumber, requests: requests.map(({ method, path, status }) => ({ method, path, status })), errors }, null, 2));
  console.log(JSON.stringify({ viewport: "390x844", requests: requests.map(({ method, path, status }) => ({ method, path, status })), errors }));
} catch (error) {
	runFailure = error;
} finally {
	await browser.close();
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
let cleanupFailure;
try {
	await client.connect();
	await client.query("BEGIN");
	await client.query("DELETE FROM ops.admin_audit_log WHERE target_id=$1 OR target_id IN (SELECT id::text FROM daily.loto_draw WHERE game='loto6' AND draw_number=ANY($2::int[]))", [runId ?? "", drawNumbers]);
	if (runId) await client.query("DELETE FROM daily.loto_generation_run WHERE id=$1", [runId]);
	await client.query("DELETE FROM daily.loto_draw WHERE game='loto6' AND draw_number=ANY($1::int[])", [drawNumbers]);
	await client.query("COMMIT");
} catch (error) {
	cleanupFailure = error;
	try {
		await client.query("ROLLBACK");
	} catch (rollbackError) {
		cleanupFailure = new AggregateError([error, rollbackError], "Loto audit fixture cleanup and rollback both failed");
	}
} finally {
	await client.end();
}

if (runFailure && cleanupFailure) throw new AggregateError([runFailure, cleanupFailure], "Loto UI audit and fixture cleanup both failed");
if (runFailure) throw runFailure;
if (cleanupFailure) throw cleanupFailure;
