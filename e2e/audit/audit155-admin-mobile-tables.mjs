import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import process from "node:process";
import { log } from "node:console";
import { chromium } from "@playwright/test";

const auditRoot = process.env.KOTOBA_LOCAL_AUDIT_ROOT ?? process.cwd();
dotenv.config({ path: path.join(auditRoot, ".env"), override: true, quiet: true });
const credentials = JSON.parse(
  fs.readFileSync(path.join(auditRoot, "tmp/local-audit/audit-138-admin.json"), "utf8")
);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const browser = await chromium.launch({ headless: false });
let connected = false;
let temporaryGrant;
const errors = [];

try {
  await db.connect();
  connected = true;
  const permission = await db.query(
    `INSERT INTO authz.admin_permission(id,code) VALUES(gen_random_uuid(),'iam.manage')
     ON CONFLICT(code) DO UPDATE SET code=EXCLUDED.code RETURNING id`
  );
  const grant = await db.query(
    `INSERT INTO authz.admin_role_permission(role_id,permission_id)
     SELECT r.id,$2 FROM authz.admin_role r WHERE r.code=$1
     ON CONFLICT DO NOTHING RETURNING role_id`,
    [credentials.roleCode, permission.rows[0].id]
  );
  if (grant.rowCount) temporaryGrant = [credentials.roleCode, permission.rows[0].id];

  const context = await browser.newContext({
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

  await page.goto("http://localhost:18081/admin/vi/login?returnTo=%2Fadmin%2Fvi");
  await page.locator('input[name="email"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === "/admin/vi", { timeout: 30_000 });
  assert.equal(
    (await context.cookies("http://localhost:18081")).find(
      (cookie) => cookie.name === "bjt_admin_session"
    )?.httpOnly,
    true,
    "Admin session is HttpOnly"
  );

  const results = [];
  for (const route of ["i18n", "iam/admins"]) {
    await page.goto(`http://localhost:18081/admin/vi/${route}`);
    await page.locator("main").waitFor({ timeout: 15_000 });
    await page.waitForTimeout(700);
    const layout = await page.evaluate(() => ({
      clientWidth: globalThis.document.documentElement.clientWidth,
      scrollWidth: globalThis.document.documentElement.scrollWidth,
      region: (() => {
        const element = globalThis.document.querySelector('[role="region"]');
        return {
          label: element?.getAttribute("aria-label"),
          tabIndex: element?.tabIndex,
          clientWidth: element?.clientWidth,
          scrollWidth: element?.scrollWidth
        };
      })()
    }));
    assert.ok(
      layout.scrollWidth <= layout.clientWidth,
      `${route} page has no horizontal overflow: ${JSON.stringify(layout)}`
    );
    assert.equal(layout.region.tabIndex, 0, `${route} table region is keyboard reachable`);
    assert.ok(
      layout.region.scrollWidth > layout.region.clientWidth,
      `${route} table scrolls inside its region`
    );
    results.push({ route, layout });
  }
  assert.deepEqual(errors, [], "no page or console errors");
  fs.writeFileSync(
    path.join(auditRoot, "tmp/local-audit/audit-155-browser-result.json"),
    JSON.stringify({ viewport: "390x844", results, errors }, null, 2)
  );
  log(JSON.stringify({ viewport: "390x844", results, errors }));
  await context.close();
} finally {
  await browser.close();
  if (temporaryGrant) {
    await db.query(
      `DELETE FROM authz.admin_role_permission WHERE role_id=(SELECT id FROM authz.admin_role WHERE code=$1) AND permission_id=$2`,
      temporaryGrant
    );
  }
  if (connected) await db.end();
}
