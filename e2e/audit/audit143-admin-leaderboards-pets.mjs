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
const fixture = `A143-${randomUUID().slice(0, 12)}`;
const petID = randomUUID();
const petUserID = randomUUID();
const browser = await chromium.launch({ headless: false });
const errors = [];
const requests = [];
let connected = false;
let context;

try {
  await client.connect();
  connected = true;
  await client.query(
    `INSERT INTO gamification.companion_pet (id,user_id,name,stage,xp,happiness,mood,total_feedings,created_at,updated_at)
     VALUES ($1,$2,$3,'egg',7,81,'happy',3,NOW(),NOW())`,
    [petID, petUserID, fixture]
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
    if (
      url.pathname.startsWith("/api/admin/gamification/leaderboards") ||
      url.pathname === "/api/admin/gamification/pets"
    )
      requests.push({
        method: response.request().method(),
        path: url.pathname,
        status: response.status()
      });
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

  await page.getByRole("button", { name: "Bảng xếp hạng" }).click();
  await page.getByRole("button", { name: /Thêm/ }).click();
  let modal = page.locator("div.fixed.inset-0").last();
  await modal.locator("input").nth(0).fill(fixture);
  await modal.locator("input").nth(1).fill("xp");
  await modal.locator("select").selectOption("weekly");
  await modal.locator('input[type="number"]').fill("25");
  await modal.getByRole("button", { name: "Lưu", exact: true }).click();
  await page.getByText(fixture, { exact: true }).waitFor();

  let row = page.getByText(fixture, { exact: true }).locator("xpath=ancestor::tr");
  await row.getByRole("button", { name: "Sửa", exact: true }).click();
  modal = page.locator("div.fixed.inset-0").last();
  await modal.locator("input").nth(0).fill(`${fixture} updated`);
  await modal.locator("select").selectOption("monthly");
  await modal.locator('input[type="number"]').fill("50");
  await modal.getByRole("button", { name: "Lưu", exact: true }).click();
  await page.getByText(`${fixture} updated`, { exact: true }).waitFor();

  row = page.getByText(`${fixture} updated`, { exact: true }).locator("xpath=ancestor::tr");
  await row.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
  await row.getByRole("button", { name: "Xoá", exact: true }).click();
  await page.locator("div.fixed.inset-0").getByRole("button", { name: "Xoá", exact: true }).click();
  await page.getByText(`${fixture} updated`, { exact: true }).waitFor({ state: "detached" });

  await page.getByRole("button", { name: "Thú cưng (Shiba)" }).click();
  await page.getByText(fixture, { exact: true }).waitFor();
  const apiCalls = requests.filter(
    ({ path }) =>
      path.startsWith("/api/admin/gamification/leaderboards") ||
      path === "/api/admin/gamification/pets"
  );
  assert.ok(
    apiCalls.some(
      (r) =>
        r.method === "GET" && r.path === "/api/admin/gamification/leaderboards" && r.status === 200
    ),
    JSON.stringify(requests)
  );
  assert.ok(
    apiCalls.some(
      (r) =>
        r.method === "POST" && r.path === "/api/admin/gamification/leaderboards" && r.status === 201
    ),
    JSON.stringify(requests)
  );
  assert.ok(
    apiCalls.some(
      (r) =>
        r.method === "PUT" &&
        r.path.startsWith("/api/admin/gamification/leaderboards/") &&
        r.status === 200
    ),
    JSON.stringify(requests)
  );
  assert.ok(
    apiCalls.some(
      (r) =>
        r.method === "DELETE" &&
        r.path.startsWith("/api/admin/gamification/leaderboards/") &&
        r.status === 200
    ),
    JSON.stringify(requests)
  );
  assert.ok(
    apiCalls.some(
      (r) => r.method === "GET" && r.path === "/api/admin/gamification/pets" && r.status === 200
    ),
    JSON.stringify(requests)
  );
  assert.equal(
    (
      await client.query(
        `SELECT count(*)::int AS n FROM gamification.leaderboard_config WHERE name=$1`,
        [fixture]
      )
    ).rows[0].n,
    0
  );
  assert.equal(
    (
      await client.query(
        `SELECT count(*)::int AS n FROM ops.admin_audit_log WHERE after->>'name' LIKE $1 OR before->>'name' LIKE $1`,
        [`${fixture}%`]
      )
    ).rows[0].n,
    3
  );
  assert.ok(
    (await page.evaluate(() => globalThis.document.documentElement.scrollWidth)) <= 390,
    "gamification screen fits 390px"
  );
  assert.deepEqual(errors, [], "no console or page errors");
  await page.screenshot({ path: "/tmp/audit143-admin-gamification-390.png", fullPage: true });
  fs.writeFileSync(
    "tmp/local-audit/audit-143-result.json",
    JSON.stringify({ viewport: "390x844", requests, errors }, null, 2)
  );
  globalThis.console.log(JSON.stringify({ viewport: "390x844", requests, errors }));
} finally {
  await context?.close();
  await browser.close();
  if (connected) {
    await client.query(
      `DELETE FROM ops.admin_audit_log WHERE target_type='gamification.leaderboard_config' AND (after->>'name' LIKE $1 OR before->>'name' LIKE $1 OR target_id IN (SELECT id::text FROM gamification.leaderboard_config WHERE name LIKE $1))`,
      [`${fixture}%`]
    );
    await client.query(`DELETE FROM gamification.leaderboard_config WHERE name LIKE $1`, [
      `${fixture}%`
    ]);
    await client.query(`DELETE FROM gamification.companion_pet WHERE id=$1`, [petID]);
    await client.end();
  }
}
