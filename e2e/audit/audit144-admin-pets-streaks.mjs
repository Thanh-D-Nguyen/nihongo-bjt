import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";
import { chromium } from "@playwright/test";

dotenv.config({ override: true, quiet: true });
const base = "http://localhost:18081";
const credentials = JSON.parse(fs.readFileSync("tmp/local-audit/audit-138-admin.json", "utf8"));
const client = new pg.Client({ connectionString: globalThis.process.env.DATABASE_URL });
const fixture = `A144-${randomUUID().slice(0, 12)}`;
const petID = randomUUID();
const petUserID = randomUUID();
const streakID = randomUUID();
const errors = [];
const requests = [];
const browser = await chromium.launch({ headless: false });
let context;
let connected = false;

try {
  await client.connect();
  connected = true;
  await client.query(
    `INSERT INTO gamification.companion_pet (id,user_id,name,stage,xp,happiness,mood,total_feedings,created_at,updated_at)
     VALUES ($1,$2,$3,'adult',50,60,'neutral',4,NOW(),NOW())`,
    [petID, petUserID, fixture]
  );
  await client.query(
    `INSERT INTO gamification.streak_config (id,name,activity_type,min_actions_per_day,freezes_allowed,enabled,created_at,updated_at)
     VALUES ($1,$2,'review',2,1,true,NOW(),NOW())`,
    [streakID, `${fixture} streak`]
  );
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    const url = new globalThis.URL(response.url());
    if (url.pathname.startsWith("/api/admin/gamification/pets") || url.pathname === "/api/admin/gamification/streaks") {
      requests.push({ method: response.request().method(), path: url.pathname, status: response.status() });
    }
  });

  await page.goto(`${base}/admin/vi/login?returnTo=%2Fadmin%2Fvi%2Fgamification`);
  await page.locator('input[name="email"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === "/admin/vi/gamification", { timeout: 30_000 });
  assert.equal(
    (await context.cookies(base)).find((cookie) => cookie.name === "bjt_admin_session")?.httpOnly,
    true
  );
  await page.getByText(`${fixture} streak`, { exact: true }).waitFor();

  await page.getByRole("button", { name: "Thú cưng (Shiba)" }).click();
  let row = page.getByText(fixture, { exact: true }).locator("xpath=ancestor::tr");
  await row.waitFor();
  const detail = await page.evaluate(async (id) => {
    const response = await globalThis.fetch(`/api/admin/gamification/pets/${id}`);
    return { status: response.status, body: await response.json() };
  }, petID);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.name, fixture);
  assert.equal(detail.body.userId, petUserID);

  await row.getByRole("button", { name: "Sửa", exact: true }).click();
  let modal = page.locator("div.fixed.inset-0").last();
  await modal.locator("input").nth(0).fill(`${fixture} updated`);
  await modal.locator("select").selectOption("teen");
  await modal.locator('input[type="number"]').nth(0).fill("80");
  await modal.locator('input[type="number"]').nth(1).fill("30");
  await modal.getByRole("button", { name: "Lưu", exact: true }).click();
  await page.getByText(`${fixture} updated`, { exact: true }).waitFor();

  row = page.getByText(`${fixture} updated`, { exact: true }).locator("xpath=ancestor::tr");
  await row.getByRole("button", { name: "Reset", exact: true }).click();
  modal = page.locator("div.fixed.inset-0").last();
  await page.waitForLoadState("networkidle");
  const resetResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "POST" && response.url().endsWith(`/api/admin/gamification/pets/${petID}/reset`)
  );
  const petsReloadPromise = page.waitForResponse((response) =>
    response.request().method() === "GET" && new globalThis.URL(response.url()).pathname === "/api/admin/gamification/pets"
  );
  await modal.getByRole("button", { name: "Xoá", exact: true }).click();
  const resetResponse = await resetResponsePromise;
  assert.equal(resetResponse.status(), 200);
  assert.equal((await resetResponse.json()).reset, true);
  assert.equal((await petsReloadPromise).status(), 200);

  const check = await client.query(
    `SELECT stage,xp,happiness,mood,total_feedings FROM gamification.companion_pet WHERE id=$1`,
    [petID]
  );
  assert.deepEqual(check.rows[0], { stage: "egg", xp: 0, happiness: 100, mood: "happy", total_feedings: 0 });
  const audit = await client.query(
    `SELECT action FROM ops.admin_audit_log WHERE target_id=$1 ORDER BY action`,
    [petID]
  );
  assert.deepEqual(audit.rows.map((entry) => entry.action).sort(), [
    "admin.gamification.pet.reset",
    "admin.gamification.pet.updated"
  ]);

  for (const [method, path, status] of [
    ["GET", "/api/admin/gamification/pets/stats", 200],
    ["GET", `/api/admin/gamification/pets/${petID}`, 200],
    ["PUT", `/api/admin/gamification/pets/${petID}`, 200],
    ["POST", `/api/admin/gamification/pets/${petID}/reset`, 200],
    ["GET", "/api/admin/gamification/streaks", 200]
  ]) {
    assert.ok(requests.some((request) => request.method === method && request.path === path && request.status === status), JSON.stringify(requests));
  }
  assert.ok((await page.evaluate(() => globalThis.document.documentElement.scrollWidth)) <= 390, "gamification screen fits 390px");
  assert.deepEqual(errors, [], "no console or page errors");
  await page.screenshot({ path: "/tmp/audit144-admin-gamification-pets-390.png", fullPage: true });
  fs.writeFileSync("tmp/local-audit/audit-144-result.json", JSON.stringify({ viewport: "390x844", requests, errors }, null, 2));
  globalThis.console.log(JSON.stringify({ viewport: "390x844", requests, errors }));
} finally {
  await context?.close();
  await browser.close();
  if (connected) {
    await client.query(`DELETE FROM ops.admin_audit_log WHERE target_id=$1`, [petID]);
    await client.query(`DELETE FROM gamification.companion_pet WHERE id=$1`, [petID]);
    await client.query(`DELETE FROM gamification.streak_config WHERE id=$1`, [streakID]);
    await client.end();
  }
}
