import assert from "node:assert/strict";
import console from "node:console";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import process from "node:process";
import { URL } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { chromium } from "@playwright/test";

/* global document fetch */

dotenv.config({ override: true, quiet: true });
const base = "http://localhost:18081";
const credentials = JSON.parse(fs.readFileSync("tmp/local-audit/audit-138-admin.json", "utf8"));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const achievementID = randomUUID();
const tierID = randomUUID();
const slug = `audit142-${achievementID}`;
let createdID;
const browser = await chromium.launch({ headless: false });
const errors = [];
const requests = [];
let connected = false;
let context;
let createdTierID;

try {
  await client.connect();
  connected = true;
  await client.query(
    `INSERT INTO gamification.achievement_definition
      (id,slug,name_key,description_key,category,metric_key,enabled,created_at,updated_at)
     VALUES ($1,$2,'achievement.audit142.fixture','achievement.audit142.fixture.description','learning','words_learned',true,NOW(),NOW())`,
    [achievementID, slug]
  );
  await client.query(
    `INSERT INTO gamification.achievement_tier (id,achievement_id,tier,threshold)
     VALUES ($1,$2,'bronze',1)`,
    [tierID, achievementID]
  );
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/admin/gamification/achievements"))
      requests.push({ method: response.request().method(), path: url.pathname, status: response.status() });
  });
  await page.goto(`${base}/admin/vi/login?returnTo=%2Fadmin%2Fvi%2Fgamification`);
  await page.locator('input[name="email"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === "/admin/vi/gamification", { timeout: 30_000 });
  assert.equal((await context.cookies(base)).find((cookie) => cookie.name === "bjt_admin_session")?.httpOnly, true);
  await page.getByRole("button", { name: "Thành tích" }).click();
  await page.getByText(slug, { exact: true }).waitFor();

  const responses = await page.evaluate(async ({ achievementID, tierID, slug }) => {
    const call = async (method, path, body) => {
      const response = await fetch(path, {
        method,
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      return { method, path, status: response.status, body: await response.json() };
    };
    const results = [
      await call("GET", "/api/admin/gamification/achievements"),
      await call("POST", "/api/admin/gamification/achievements", {
        slug: `${slug}-created`, nameKey: "achievement.audit142.created",
        descriptionKey: "achievement.audit142.created.description", category: "learning",
        metricKey: "words_learned", enabled: true
      }),
      await call("GET", `/api/admin/gamification/achievements/${achievementID}`),
      await call("POST", `/api/admin/gamification/achievements/${achievementID}/tiers`, {
        tier: "gold", threshold: 20
      }),
      await call("PUT", `/api/admin/gamification/achievements/${achievementID}`, {
        slug, nameKey: "achievement.audit142.name", descriptionKey: "achievement.audit142.updated",
        category: "learning", metricKey: "words_learned", displayOrder: 0, enabled: true
      }),
      await call("PUT", `/api/admin/gamification/achievements/tiers/${tierID}`, {
        tier: "silver", threshold: 10
      }),
      await call("GET", `/api/admin/gamification/achievements/${achievementID}/tiers`),
      await call("DELETE", `/api/admin/gamification/achievements/tiers/${tierID}`)
    ];
    return results;
  }, { achievementID, tierID, slug });
  createdID = responses[1]?.body?.id;
  createdTierID = responses[3]?.body?.id;
  assert.deepEqual(responses.map((response) => response.status), [200, 201, 200, 201, 200, 200, 200, 200], JSON.stringify(responses));
  assert.ok(createdID, "create response includes persisted id");
  assert.equal(responses[6].body[0]?.tier, "silver");
  assert.equal(responses[6].body[0]?.threshold, 10);
  for (const response of responses) assert.ok(requests.some((request) => request.method === response.method && request.path === response.path && request.status === response.status));
  const rows = await client.query(
    `SELECT id,slug FROM gamification.achievement_definition WHERE id=$1`, [createdID]
  );
  assert.equal(rows.rows[0]?.slug, `${slug}-created`);
  const removed = await page.evaluate(async (id) => {
    const response = await fetch(`/api/admin/gamification/achievements/${id}`, { method: "DELETE", credentials: "include" });
    return { method: "DELETE", path: `/api/admin/gamification/achievements/${id}`, status: response.status, body: await response.json() };
  }, createdID);
  responses.push(removed);
  assert.equal(removed.status, 200);
  assert.ok(requests.some((request) => request.method === removed.method && request.path === removed.path && request.status === removed.status));
  assert.equal((await client.query(`SELECT count(*)::int AS n FROM gamification.achievement_definition WHERE id=$1`, [createdID])).rows[0].n, 0);
  const audit = await client.query(
    `SELECT action FROM ops.admin_audit_log WHERE target_id::text=ANY($1::text[]) ORDER BY action`,
    [[createdID, achievementID, tierID, createdTierID]]
  );
  assert.deepEqual(audit.rows.map((row) => row.action).sort(), [
    "admin.gamification.achievement.created",
    "admin.gamification.achievement.deleted",
    "admin.gamification.achievement.updated",
    "admin.gamification.achievement_tier.created",
    "admin.gamification.achievement_tier.deleted",
    "admin.gamification.achievement_tier.updated"
  ].sort());
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= 390, "gamification screen fits 390px");
  assert.deepEqual(errors, [], "no console or page errors");
  await page.screenshot({ path: "/tmp/audit142-admin-achievements-390.png", fullPage: true });
  fs.writeFileSync("tmp/local-audit/audit-142-result.json", JSON.stringify({ viewport: "390x844", responses, requests, errors }, null, 2));
  console.log(JSON.stringify({ viewport: "390x844", responses: responses.map(({ method, path, status }) => ({ method, path, status })), errors }));
} finally {
  await context?.close();
  await browser.close();
  if (connected) {
    await client.query("DELETE FROM ops.admin_audit_log WHERE target_id::text=ANY($1::text[]) OR after->>'slug'=$2", [[achievementID, tierID, createdID, createdTierID], `${slug}-created`]);
    await client.query("DELETE FROM gamification.achievement_tier WHERE achievement_id=$1", [achievementID]);
    await client.query("DELETE FROM gamification.achievement_definition WHERE id=$1 OR slug=$2", [achievementID, `${slug}-created`]);
    await client.end();
  }
}
