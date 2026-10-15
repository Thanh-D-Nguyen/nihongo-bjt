/* global document -- used only inside page.evaluate, which runs in the browser */
import assert from "node:assert/strict";
import console from "node:console";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import process from "node:process";
import { URL } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { chromium } from "@playwright/test";

dotenv.config({ override: true, quiet: true });
const base = "http://localhost:18081";
const credentials = JSON.parse(fs.readFileSync("tmp/local-audit/audit-138-admin.json", "utf8"));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const suffix = randomUUID().slice(0, 12);
const campaignName = `A146-${suffix}`;
const postcardSlug = `a146-${suffix}`;
const errors = [];
const requests = [];
const grantsAdded = [];
const browser = await chromium.launch({ headless: false });
let context;
let connected = false;
const campaignIDs = [];
let postcardID;

try {
  await client.connect();
  connected = true;
  for (const code of ["admin.growth.read", "growth.manage"]) {
    const permission = await client.query(
      `INSERT INTO authz.admin_permission (id,code) VALUES (gen_random_uuid(),$1)
       ON CONFLICT (code) DO UPDATE SET code=EXCLUDED.code RETURNING id`,
      [code]
    );
    const grant = await client.query(
      `INSERT INTO authz.admin_role_permission (role_id,permission_id)
       SELECT r.id,$2 FROM authz.admin_role r WHERE r.code=$1
       ON CONFLICT DO NOTHING RETURNING role_id`,
      [credentials.roleCode, permission.rows[0].id]
    );
    if (grant.rowCount) grantsAdded.push([credentials.roleCode, permission.rows[0].id]);
  }

  context = await browser.newContext({
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
    if (
      url.pathname.startsWith("/api/admin/growth/campaigns") ||
      url.pathname.startsWith("/api/admin/growth/postcards")
    ) {
      requests.push({
        method: response.request().method(),
        path: url.pathname,
        status: response.status()
      });
    }
  });

  await page.goto(`${base}/admin/vi/login?returnTo=%2Fadmin%2Fvi`);
  await page.locator('input[name="email"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  const dashboardSummaryWait = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/admin/content/summary"
  );
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === "/admin/vi", { timeout: 30_000 });
  assert.equal(
    (await context.cookies(base)).find((cookie) => cookie.name === "bjt_admin_session")?.httpOnly,
    true
  );
  const dashboardSummary = await dashboardSummaryWait;
  assert.equal(dashboardSummary.status(), 200);

  await page.goto(`${base}/admin/vi/growth/campaigns`);
  await page.getByRole("button", { name: "Tạo chiến dịch", exact: true }).click();
  await page.getByLabel("Tên", { exact: true }).fill(campaignName);
  await page.getByLabel("Kênh", { exact: true }).selectOption("in_app");
  await page.getByLabel("Gói", { exact: true }).fill("free");
  const localDateTime = (date) =>
    new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  await page.getByLabel("Bắt đầu", { exact: true }).fill(
    localDateTime(new Date(Date.now() + 60 * 60_000))
  );
  await page.getByLabel("Kết thúc", { exact: true }).fill(
    localDateTime(new Date(Date.now() + 2 * 60 * 60_000))
  );
  assert.equal(
    await page.getByLabel("Quốc gia").count(),
    0,
    "unsupported country targeting is not offered"
  );
  await page.getByLabel("Lý do (≥3 ký tự)", { exact: true }).fill("AUDIT-146 browser fixture");
  const estimateWait = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/admin/growth/campaigns/audience-estimate"
  );
  assert.equal((await estimateWait).status(), 200);
  const createWait = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/admin/growth/campaigns"
  );
  const detailWait = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      /^\/api\/admin\/growth\/campaigns\/[0-9a-f-]+$/i.test(new URL(response.url()).pathname)
  );
  await page.getByRole("button", { name: "Tạo", exact: true }).last().click();
  const created = await createWait;
  assert.equal(created.status(), 201);
  const createdBody = await created.json();
  campaignIDs.push(createdBody.id);
  assert.ok(createdBody.scheduleStart && createdBody.scheduleEnd, `schedule fields saved: ${JSON.stringify(createdBody)}`);
  assert.ok(Date.parse(createdBody.scheduleStart) > Date.now(), `schedule start is future: ${JSON.stringify(createdBody)}`);
  assert.equal((await detailWait).status(), 200);
  await page.getByRole("heading", { name: campaignName, exact: true }).waitFor();

  await page.getByRole("button", { name: "Sửa", exact: true }).click();
  await page.getByLabel("Tên", { exact: true }).fill(`${campaignName}-updated`);
  await page.getByLabel("Lý do (≥3 ký tự)", { exact: true }).fill("AUDIT-146 patch fixture");
  const patchWait = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === `/api/admin/growth/campaigns/${createdBody.id}`
  );
  await page.getByRole("button", { name: "Lưu", exact: true }).last().click();
  const patched = await patchWait;
  assert.equal(patched.status(), 200);
  assert.ok(Date.parse((await patched.json()).scheduleStart) > Date.now(), "editing keeps the scheduled start in the future");

  for (const [kind, buttonName, submitName] of [
    ["schedule", "Lên lịch", "Lên lịch"],
    ["activate", "Kích hoạt", "Kích hoạt"],
    ["end", "Kết thúc", "Kết thúc"],
    ["archive", "Lưu trữ", "Lưu trữ"],
    ["duplicate", "Nhân bản", "Nhân bản"]
  ]) {
    await page.getByRole("button", { name: buttonName, exact: true }).last().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Lý do (≥3 ký tự)", { exact: true }).fill(`AUDIT-146 ${kind}`);
    const responseWait = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname ===
          `/api/admin/growth/campaigns/${campaignIDs.at(-1)}/${kind}`
    );
    await dialog.getByRole("button", { name: submitName, exact: true }).click();
    const response = await responseWait;
    assert.equal(response.status(), 200, `${kind} response: ${await response.text()}`);
    const body = await response.json();
    if (kind === "duplicate") campaignIDs.push(body.id);
  }

  await page.goto(`${base}/admin/vi/growth/postcards`);
  const listWait = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/admin/growth/postcards"
  );
  await listWait;
  await page.getByRole("button", { name: "Tạo template", exact: true }).click();
  await page.getByLabel(/Slug/).fill(postcardSlug);
  await page.getByLabel(/^Tên/).fill(`AUDIT-146 ${suffix}`);
  await page.getByLabel(/Body template/).fill("{user_name} is learning Japanese");
  await page.getByLabel(/Lý do/).fill("AUDIT-146 browser fixture");
  const postcardWait = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/admin/growth/postcards"
  );
  await page.getByRole("button", { name: "Tạo", exact: true }).last().click();
  const postcardResponse = await postcardWait;
  assert.equal(postcardResponse.status(), 201);
  postcardID = (await postcardResponse.json()).id;
  // The slug renders in both the template preview and the list row; either proves the created row is shown.
  await page.getByText(postcardSlug, { exact: true }).first().waitFor();

  for (const [method, path, status] of [
    ["GET", "/api/admin/growth/campaigns/audience-estimate", 200],
    ["GET", `/api/admin/growth/campaigns/${createdBody.id}`, 200],
    ["PATCH", `/api/admin/growth/campaigns/${createdBody.id}`, 200],
    ["POST", `/api/admin/growth/campaigns/${createdBody.id}/schedule`, 200],
    ["POST", `/api/admin/growth/campaigns/${createdBody.id}/activate`, 200],
    ["POST", `/api/admin/growth/campaigns/${createdBody.id}/end`, 200],
    ["POST", `/api/admin/growth/campaigns/${createdBody.id}/archive`, 200],
    ["POST", `/api/admin/growth/campaigns/${createdBody.id}/duplicate`, 200],
    ["GET", "/api/admin/growth/postcards", 200],
    ["POST", "/api/admin/growth/postcards", 201]
  ]) {
    assert.ok(
      requests.some(
        (request) => request.method === method && request.path === path && request.status === status
      ),
      `${method} ${path}: ${JSON.stringify(requests)}`
    );
  }
  const mobileLayout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    offenders: [...document.querySelectorAll("body *")]
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        text: element.textContent?.trim().slice(0, 80),
        className: typeof element.className === "string" ? element.className : "",
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
        width: Math.round(element.getBoundingClientRect().width)
      }))
      .filter(
        (element) => element.right > document.documentElement.clientWidth + 1 || element.left < -1
      )
      .sort(
        (a, b) =>
          b.right -
          document.documentElement.clientWidth -
          (a.right - document.documentElement.clientWidth)
      )
      .slice(0, 20),
    scrollWidth: document.documentElement.scrollWidth
  }));
  await page.screenshot({ path: "/tmp/audit146-growth-postcards-390.png", fullPage: true });
  fs.writeFileSync("/tmp/audit146-mobile-layout.json", JSON.stringify(mobileLayout, null, 2));
  assert.ok(
    mobileLayout.scrollWidth <= mobileLayout.clientWidth,
    `postcard screen fits 390px: ${JSON.stringify(mobileLayout)}`
  );
  assert.deepEqual(errors, [], "no console or page errors");
  fs.writeFileSync(
    "tmp/local-audit/audit-146-browser-result.json",
    JSON.stringify({ viewport: "390x844", requests, errors }, null, 2)
  );
  console.log(JSON.stringify({ viewport: "390x844", requests, errors }));
} finally {
  await context?.close();
  await browser.close();
  if (connected) {
    for (const id of campaignIDs) {
      await client.query(`DELETE FROM ops.admin_audit_log WHERE target_id=$1`, [id]);
      await client.query(`DELETE FROM growth.growth_campaign WHERE id=$1`, [id]);
    }
    if (postcardID) {
      await client.query(`DELETE FROM ops.admin_audit_log WHERE target_id=$1`, [postcardID]);
      await client.query(`DELETE FROM growth.share_template WHERE id=$1`, [postcardID]);
    }
    for (const [role, permission] of grantsAdded) {
      await client.query(
        `DELETE FROM authz.admin_role_permission WHERE role_id=(SELECT id FROM authz.admin_role WHERE code=$1) AND permission_id=$2`,
        [role, permission]
      );
    }
    await client.end();
  }
}
