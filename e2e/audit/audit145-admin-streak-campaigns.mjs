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
const fixture = `A145-${randomUUID().slice(0, 12)}`;
const errors = [];
const requests = [];
const browser = await chromium.launch({ headless: false });
let context;
let connected = false;
let campaignID;
let streakID;

try {
  await client.connect();
  connected = true;
  for (const code of ["admin.growth.read", "growth.manage"]) {
    await client.query(
      `INSERT INTO authz.admin_permission (id,code) VALUES (gen_random_uuid(),$1) ON CONFLICT (code) DO NOTHING`,
      [code]
    );
    await client.query(
      `INSERT INTO authz.admin_role_permission (role_id,permission_id) SELECT r.id,p.id FROM authz.admin_role r CROSS JOIN authz.admin_permission p WHERE r.code=$1 AND p.code=$2 ON CONFLICT DO NOTHING`,
      [credentials.roleCode, code]
    );
  }
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
    if (
      url.pathname.startsWith("/api/admin/gamification/streaks") ||
      url.pathname.startsWith("/api/admin/growth/campaigns")
    ) {
      requests.push({
        method: response.request().method(),
        path: url.pathname,
        status: response.status()
      });
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

  await page.getByRole("button", { name: "+ Thêm", exact: true }).first().click();
  let modal = page.locator("div.fixed.inset-0").last();
  await modal.locator("input").nth(0).fill(fixture);
  await modal.locator("input").nth(1).fill("review");
  await modal.locator('input[type="number"]').nth(0).fill("2");
  const streakCreate = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new globalThis.URL(response.url()).pathname === "/api/admin/gamification/streaks"
  );
  await modal.getByRole("button", { name: "Lưu", exact: true }).click();
  const streakCreateResponse = await streakCreate;
  assert.equal(streakCreateResponse.status(), 201);
  streakID = (await streakCreateResponse.json()).id;
  await page.getByText(fixture, { exact: true }).waitFor();

  let row = page.getByText(fixture, { exact: true }).locator("xpath=ancestor::tr");
  await row.getByRole("button", { name: "Sửa", exact: true }).click();
  modal = page.locator("div.fixed.inset-0").last();
  await modal.locator("input").nth(1).fill("quiz");
  await modal.locator('input[type="number"]').nth(0).fill("3");
  const streakUpdate = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new globalThis.URL(response.url()).pathname === `/api/admin/gamification/streaks/${streakID}`
  );
  await modal.getByRole("button", { name: "Lưu", exact: true }).click();
  assert.equal((await streakUpdate).status(), 200);
  await page.getByText(fixture, { exact: true }).waitFor();

  row = page.getByText(fixture, { exact: true }).locator("xpath=ancestor::tr");
  await row.getByRole("button", { name: "Xoá", exact: true }).click();
  const confirm = page.locator("div.fixed.inset-0").last();
  const streakDelete = page.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      new globalThis.URL(response.url()).pathname === `/api/admin/gamification/streaks/${streakID}`
  );
  await confirm.getByRole("button", { name: "Xoá", exact: true }).click();
  assert.equal((await streakDelete).status(), 200);

  await page.goto(`${base}/admin/vi/growth/campaigns`);
  await page.getByRole("button", { name: "Tạo chiến dịch", exact: true }).waitFor();
  await page.getByRole("button", { name: "Tạo chiến dịch", exact: true }).click();
  await page.getByLabel("Tên", { exact: true }).fill(fixture);
  await page.getByLabel("Kênh", { exact: true }).selectOption("in_app");
  await page.getByLabel("Lý do (≥3 ký tự)", { exact: true }).fill("AUDIT-145 browser");
  const campaignCreate = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new globalThis.URL(response.url()).pathname === "/api/admin/growth/campaigns"
  );
  await page.getByRole("button", { name: "Tạo", exact: true }).last().click();
  const campaignResponse = await campaignCreate;
  assert.equal(campaignResponse.status(), 201);
  campaignID = (await campaignResponse.json()).id;
  await page.getByText(fixture, { exact: true }).waitFor();

  const campaign = await client.query(
    `SELECT status,channel,created_by_id FROM growth.growth_campaign WHERE id=$1`,
    [campaignID]
  );
  assert.equal(campaign.rows[0]?.status, "draft");
  assert.equal(campaign.rows[0]?.channel, "in_app");
  const streakCount = await client.query(
    `SELECT count(*)::int AS count FROM gamification.streak_config WHERE id=$1`,
    [streakID]
  );
  assert.equal(streakCount.rows[0]?.count, 0);
  const audit = await client.query(
    `SELECT action,reason FROM ops.admin_audit_log WHERE target_id=$1`,
    [campaignID]
  );
  assert.deepEqual(
    audit.rows.map((entry) => entry.action),
    ["admin.growth.campaign.created"]
  );
  assert.equal(audit.rows[0]?.reason, "AUDIT-145 browser");

  for (const [method, path, status] of [
    ["GET", "/api/admin/gamification/streaks", 200],
    ["POST", "/api/admin/gamification/streaks", 201],
    ["PUT", `/api/admin/gamification/streaks/${streakID}`, 200],
    ["DELETE", `/api/admin/gamification/streaks/${streakID}`, 200],
    ["GET", "/api/admin/growth/campaigns", 200],
    ["POST", "/api/admin/growth/campaigns", 201]
  ]) {
    assert.ok(
      requests.some(
        (request) => request.method === method && request.path === path && request.status === status
      ),
      JSON.stringify(requests)
    );
  }
  assert.ok(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.document.documentElement.clientWidth
    ),
    "growth campaign screen fits 390px"
  );
  assert.deepEqual(errors, [], "no console or page errors");
  await page.screenshot({ path: "/tmp/audit145-admin-growth-campaigns-390.png", fullPage: true });
  fs.writeFileSync(
    "tmp/local-audit/audit-145-result.json",
    JSON.stringify({ viewport: "390x844", requests, errors }, null, 2)
  );
  globalThis.console.log(JSON.stringify({ viewport: "390x844", requests, errors }));
} finally {
  await context?.close();
  await browser.close();
  if (connected) {
    if (campaignID) {
      await client.query(`DELETE FROM ops.admin_audit_log WHERE target_id=$1`, [campaignID]);
      await client.query(`DELETE FROM growth.growth_campaign WHERE id=$1`, [campaignID]);
    }
    if (streakID) {
      await client.query(`DELETE FROM ops.admin_audit_log WHERE target_id=$1`, [streakID]);
      await client.query(`DELETE FROM gamification.streak_config WHERE id=$1`, [streakID]);
    }
    await client.end();
  }
}
