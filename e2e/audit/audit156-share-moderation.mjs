/* global process, crypto, document, window, fetch, console */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { chromium } from "@playwright/test";

const root = process.env.KOTOBA_LOCAL_AUDIT_ROOT ?? process.cwd();
dotenv.config({ path: path.join(root, ".env"), override: true, quiet: true });
const credentials = JSON.parse(
  fs.readFileSync(path.join(root, "tmp/local-audit/audit-138-admin.json"), "utf8")
);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const browser = await chromium.launch({ headless: false });
const userId = crypto.randomUUID();
const eventId = crypto.randomUUID();
const token = `audit156${eventId.replaceAll("-", "")}`;
const roleCode = credentials.roleCode;
let connected = false;
let granted;
const errors = [];
const httpErrors = [];

try {
  await db.connect();
  connected = true;
  const permission = await db.query(
    `INSERT INTO authz.admin_permission(id,code) VALUES(gen_random_uuid(),'growth.manage')
     ON CONFLICT(code) DO UPDATE SET code=EXCLUDED.code RETURNING id`
  );
  const grant = await db.query(
    `INSERT INTO authz.admin_role_permission(role_id,permission_id)
     SELECT r.id,$2 FROM authz.admin_role r WHERE r.code=$1
     ON CONFLICT DO NOTHING RETURNING role_id`,
    [roleCode, permission.rows[0].id]
  );
  if (grant.rowCount) granted = [roleCode, permission.rows[0].id];
  await db.query(
    `INSERT INTO profile.user_profile (id,display_name,email,status,updated_at)
     VALUES ($1,'AUDIT-156 browser share',$2,'active',now())`,
    [userId, `audit156-${userId.slice(0, 8)}@example.test`]
  );
  await db.query(
    `INSERT INTO growth.share_item (id,user_id,public_token,kind,summary_payload,created_at)
     VALUES ($1,$2,$3,'achievement','{"headline":"Disposable share"}',now())`,
    [eventId, userId, token]
  );

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      httpErrors.push({ url: response.url(), status: response.status() });
  });
  const anonymous = await context.newPage();
  const live = await anonymous.goto(`http://localhost:18081/api/public/shares/${token}`);
  assert.equal(live.status(), 200, "anonymous live share is readable before moderation");
  assert.equal(live.headers()["cache-control"], "no-store");
  await anonymous.close();

  await page.goto("http://localhost:18081/admin/vi/login?returnTo=%2Fadmin%2Fvi");
  await page.locator('input[name="email"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === "/admin/vi", { timeout: 30_000 });
  assert.equal(
    (await context.cookies("http://localhost:18081")).find(
      (cookie) => cookie.name === "bjt_admin_session"
    )?.httpOnly,
    true
  );

  await page.goto("http://localhost:18081/admin/vi/growth/social");
  await page.getByRole("button", { name: "Sự kiện chia sẻ" }).click();
  const layout = await page.evaluate(() => {
    const region = document.querySelector('[role="region"][aria-label="Sự kiện chia sẻ"]');
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      regionTabIndex: region?.tabIndex,
      regionClientWidth: region?.clientWidth,
      regionScrollWidth: region?.scrollWidth
    };
  });
  assert.ok(
    layout.scrollWidth <= layout.clientWidth,
    `page overflows at 390px: ${JSON.stringify(layout)}`
  );
  assert.equal(layout.regionTabIndex, 0, "events table region is keyboard reachable");
  assert.ok(
    layout.regionScrollWidth > layout.regionClientWidth,
    `wide events table scrolls inside its region: ${JSON.stringify(layout)}`
  );
  const region = page.getByRole("region", { name: "Sự kiện chia sẻ" });
  await region.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  const row = page.getByRole("row").filter({ hasText: `${token.slice(0, 12)}…` });
  await row.waitFor({ timeout: 20_000 });
  await row.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -120));
  await row.getByRole("button", { name: "Ẩn khỏi public" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Lý do (≥3 ký tự)").fill("audit156 hide share");
  const moderation = page.waitForResponse((response) =>
    response.url().includes(`/api/admin/growth/social/events/${eventId}/moderate`)
  );
  await dialog.getByRole("button", { name: "Xác nhận" }).click();
  const moderated = await moderation;
  assert.equal(moderated.status(), 200, "the real Admin UI moderation form succeeds");

  const hidden = await page.evaluate(async (shareToken) => {
    const response = await fetch(`/api/public/shares/${shareToken}`, { cache: "no-store" });
    return { status: response.status, cacheControl: response.headers.get("cache-control") };
  }, token);
  assert.equal(hidden.status, 404, "moderated share is no longer public");
  assert.equal(hidden.cacheControl, "no-store");
  await page.waitForTimeout(250);
  const persisted = await db.query(`SELECT expires_at FROM growth.share_item WHERE id=$1`, [
    eventId
  ]);
  assert.ok(persisted.rows[0].expires_at, "moderation persists the expiry cutoff");
  assert.deepEqual(
    httpErrors.filter(
      ({ url, status }) => !(url.endsWith(`/api/public/shares/${token}`) && status === 404)
    ),
    [],
    "no unexpected HTTP errors"
  );
  assert.ok(
    errors.every(
      (message) =>
        message === "Failed to load resource: the server responded with a status of 404 (Not Found)"
    ),
    `no unexpected browser page or console errors: ${JSON.stringify(errors)}`
  );
  fs.writeFileSync(
    path.join(root, "tmp/local-audit/audit-156-browser-result.json"),
    JSON.stringify(
      {
        viewport: "390x844",
        liveStatus: live.status(),
        moderationStatus: moderated.status(),
        hiddenStatus: hidden.status,
        httpErrors,
        errors
      },
      null,
      2
    )
  );
  console.log(
    JSON.stringify({
      viewport: "390x844",
      live: live.status(),
      moderation: moderated.status(),
      hidden: hidden.status,
      errors
    })
  );
  await context.close();
} finally {
  await browser.close();
  if (connected) {
    await db.query(`DELETE FROM ops.admin_audit_log WHERE target_id=$1`, [eventId]);
    await db.query(`DELETE FROM growth.share_item WHERE id=$1`, [eventId]);
    await db.query(`DELETE FROM profile.user_profile WHERE id=$1`, [userId]);
    if (granted) {
      await db.query(
        `DELETE FROM authz.admin_role_permission WHERE role_id=(SELECT id FROM authz.admin_role WHERE code=$1) AND permission_id=$2`,
        granted
      );
    }
    await db.end();
  }
}
