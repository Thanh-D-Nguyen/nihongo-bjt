import assert from "node:assert/strict";
import console from "node:console";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import process from "node:process";
import { URL } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { chromium } from "@playwright/test";

/* global document */

dotenv.config({ override: true, quiet: true });
const base = "http://localhost:18081";
const credentials = JSON.parse(fs.readFileSync("tmp/local-audit/audit-138-admin.json", "utf8"));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const ids = { lexeme: randomUUID(), grammar: randomUUID(), variant: randomUUID() };
const fixtureFront = `audit141 ${ids.variant}`;
const updatedFront = `${fixtureFront} updated`;
const browser = await chromium.launch({ headless: false });
const errors = [];
const requests = [];
let connected = false;

try {
  await client.connect();
  connected = true;
  await client.query("BEGIN");
  await client.query(
    `INSERT INTO content.lexeme (id,headword,reading,jlpt_level,short_meaning_vi,status,created_at,updated_at)
    VALUES ($1,$2,'あうでぃっと','N5','fixture','active',NOW(),NOW())`,
    [ids.lexeme, `audit141 lexeme ${ids.variant}`]
  );
  await client.query(
    `INSERT INTO content.grammar_point (id,pattern,meaning_vi,jlpt_level,status,created_at,updated_at)
    VALUES ($1,$2,'fixture','N5','active',NOW(),NOW())`,
    [ids.grammar, `〜audit141 ${ids.variant}`]
  );
  await client.query(
    `INSERT INTO learning.flashcard_variant
    (id,source_type,source_id,front_text,back_text,reading,status,created_at,updated_at)
    VALUES ($1,'lexeme',$2,$3,'before back','あうでぃっと','draft',NOW(),NOW())`,
    [ids.variant, ids.lexeme, fixtureFront]
  );
  await client.query("COMMIT");

  const context = await browser.newContext({
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
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/admin/flashcards/variants"))
      requests.push({
        method: response.request().method(),
        path: url.pathname,
        status: response.status()
      });
  });

  await page.goto(`${base}/admin/vi/login?returnTo=%2Fadmin%2Fvi%2Fflashcards%2Ftemplates`);
  await page.locator('input[name="email"]').fill(credentials.email);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === "/admin/vi/flashcards/templates", {
    timeout: 30_000
  });
  assert.equal(
    (await context.cookies(base)).find((cookie) => cookie.name === "bjt_admin_session")?.httpOnly,
    true
  );

  await page.getByText(fixtureFront, { exact: true }).waitFor();
  await page.getByRole("row").filter({ hasText: fixtureFront }).click();
  await page.getByText("Examples learner deck đang dùng").waitFor();
  await page.getByText("Chưa tìm thấy nguồn canonical theo front text.").waitFor();

  await page.getByRole("button", { name: "Sửa", exact: true }).click();
  await page.getByRole("dialog").locator("input").first().fill(updatedFront);
  await page.getByRole("dialog").locator("input").nth(1).fill("");
  await page.locator("textarea").fill("audit141 updated back");
  await page.getByPlaceholder("Lý do (≥3 ký tự)…").fill("audit141 content correction");
  const save = page.getByRole("dialog").getByRole("button", { name: "Lưu", exact: true });
  assert.equal(await page.getByRole("dialog").locator("input").first().inputValue(), updatedFront);
  assert.equal(await save.isEnabled(), true);
  const saveBox = await save.boundingBox();
  assert.ok(
    saveBox.x >= 0 && saveBox.x + saveBox.width <= 390,
    `Save button is clipped at 390px: ${JSON.stringify(saveBox)}`
  );
  const patchWait = page
    .waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/admin/flashcards/variants/${ids.variant}` &&
        response.request().method() === "PATCH",
      { timeout: 30_000 }
    )
    .then(
      (response) => response,
      (error) => error
    );
  await save.click();
  let patched;
  patched = await patchWait;
  if (patched instanceof Error) throw patched;
  assert.equal(patched.status(), 200);
  await page.getByText("audit141 updated back", { exact: true }).waitFor();

  await page.getByRole("button", { name: "Phát hành", exact: true }).click();
  await page.getByPlaceholder("Lý do (≥3 ký tự)…").fill("audit141 publish");
  const transitionWait = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
      `/api/admin/flashcards/variants/${ids.variant}/transition`
  );
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  assert.equal((await transitionWait).status(), 200);

  await page.getByRole("button", { name: "Gắn source thủ công", exact: true }).click();
  await page.getByLabel("Loại source").selectOption("grammar");
  await page.getByPlaceholder("Canonical UUID…").fill(ids.grammar);
  await page.getByPlaceholder("Lý do (≥3 ký tự)…").fill("audit141 source remap");
  const sourceWait = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/admin/flashcards/variants/${ids.variant}/source`
  );
  await page.getByRole("button", { name: "Gắn nguồn này", exact: true }).click();
  assert.equal((await sourceWait).status(), 200);

  const expected = [
    ["GET", "/api/admin/flashcards/variants"],
    ["GET", `/api/admin/flashcards/variants/${ids.variant}`],
    ["PATCH", `/api/admin/flashcards/variants/${ids.variant}`],
    ["POST", `/api/admin/flashcards/variants/${ids.variant}/transition`],
    ["PATCH", `/api/admin/flashcards/variants/${ids.variant}/source`]
  ];
  for (const [method, path] of expected)
    assert.ok(
      requests.some(
        (request) => request.method === method && request.path === path && request.status === 200
      ),
      `${method} ${path} did not pass via UI`
    );
  assert.ok(
    (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390,
    "Admin screen overflows 390px viewport"
  );
  assert.deepEqual(errors, [], "headed Admin screen has no console or page errors");
  const persisted = await client.query(
    "SELECT source_type,source_id,front_text,back_text,reading,status FROM learning.flashcard_variant WHERE id=$1",
    [ids.variant]
  );
  assert.deepEqual(persisted.rows[0], {
    source_type: "grammar",
    source_id: ids.grammar,
    front_text: updatedFront,
    back_text: "audit141 updated back",
    reading: null,
    status: "active"
  });
  await page.screenshot({ path: "/tmp/audit141-admin-flashcard-variants-390.png", fullPage: true });
  fs.writeFileSync(
    "tmp/local-audit/audit-141-result.json",
    JSON.stringify(
      {
        login: "real form + HttpOnly session",
        viewport: "390x844",
        persisted: persisted.rows[0],
        requests,
        errors
      },
      null,
      2
    )
  );
  console.log(
    JSON.stringify({ viewport: "390x844", requests, errors, persisted: persisted.rows[0] })
  );
  await context.close();
} finally {
  await browser.close();
  if (connected) {
    await client.query("BEGIN");
    await client.query("DELETE FROM ops.admin_audit_log WHERE target_id=$1", [ids.variant]);
    await client.query("DELETE FROM learning.flashcard_variant WHERE id=$1", [ids.variant]);
    await client.query("DELETE FROM content.lexeme WHERE id=$1", [ids.lexeme]);
    await client.query("DELETE FROM content.grammar_point WHERE id=$1", [ids.grammar]);
    await client.query("COMMIT");
    await client.end();
  }
}
